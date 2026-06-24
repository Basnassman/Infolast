import { getOrCreateUser } from "@modules/user/utils/user";
import { taskRepository } from "../repositories/task.repository";
import { userTaskRepository } from "@modules/user/repositories/user-task.repository";
import { taskEventEmitter } from "../events/task.events";
import { analyzeFraudPatterns } from "@modules/user/fraud/fraud-detector.service";
import { verificationService } from "@modules/verification/services/verification.service";
import { verificationTaskRepository } from "@modules/verification/repositories/verification-task.repository";
import { platformAccountRepository } from "@modules/verification/repositories/platform-account.repository";

import { Task, TaskStatus, VerificationPlatform } from "@prisma/client";

import { TaskNotFoundError } from "../errors/task-not-found.error";
import { TaskInactiveError } from "../errors/task-inactive.error";
import { TaskAlreadyCompletedError } from "../errors/task-already-completed.error";
import { logger } from "@core/logger/logger";

export interface SubmitTaskPayload {
  walletAddress: string;
  taskId: string;
  ip?: string;
  userAgent?: string;
  proof?: Record<string, any>;
}

export const taskService = {
  async getAvailableTasks(walletAddress: string): Promise<Task[]> {
    await getOrCreateUser(walletAddress);

    const tasks = await taskRepository.findActive();

    return tasks;
  },

  async getUserTaskHistory(walletAddress: string): Promise<any[]> {
    const user = await getOrCreateUser(walletAddress);

    const history = await userTaskRepository.findByUser(user.id);

    return history.map((ut) => ({
      id: ut.id,
      userId: ut.userId,
      taskId: ut.taskId,
      status: ut.status,
      rewardGiven: ut.rewardGiven,
      points: ut.points,
      completedAt: ut.completedAt?.toISOString(),
      createdAt: ut.createdAt.toISOString(),
      updatedAt: ut.updatedAt.toISOString(),
    }));
  },

  async submitTask(payload: SubmitTaskPayload): Promise<any> {
    const { walletAddress, taskId, ip, userAgent, proof } = payload;

    const user = await getOrCreateUser(walletAddress);

    const task = await taskRepository.findById(taskId);

    if (!task) {
      throw new TaskNotFoundError(taskId);
    }

    if (!task.isActive) {
      throw new TaskInactiveError(taskId);
    }

    const existing = await userTaskRepository.findByUserAndTask(
      user.id,
      taskId
    );

    if (existing?.status === TaskStatus.VERIFIED) {
      throw new TaskAlreadyCompletedError(taskId);
    }

    // ─── Check if task can be auto-verified ────────────────────────
    let initialStatus: TaskStatus;
    let verificationStatus: string | undefined;

    const platformToVerification: Record<string, VerificationPlatform> = {
      TELEGRAM: VerificationPlatform.TELEGRAM,
      X: VerificationPlatform.X,
      YOUTUBE: VerificationPlatform.YOUTUBE,
      DISCORD: VerificationPlatform.DISCORD,
    };

    const verificationPlatform = platformToVerification[task.platform];

    if (verificationPlatform) {
      // Check if user has linked platform account
      const platformAccount = await platformAccountRepository.findByUserAndPlatform(
        user.id,
        verificationPlatform
      );

      if (platformAccount?.verified) {
        // Auto-verify: find matching verification task and verify
        const verificationTasks = await verificationTaskRepository.findActiveByPlatform(
          verificationPlatform
        );

        if (verificationTasks.length > 0) {
          try {
            const vResult = await verificationService.verifyUserTask(
              user.id,
              verificationTasks[0].id
            );

            if (vResult.status === "VERIFIED") {
              initialStatus = TaskStatus.VERIFIED;
              verificationStatus = "auto_verified";
            } else {
              initialStatus = TaskStatus.REVIEW;
              verificationStatus = "verification_failed";
            }
          } catch (err) {
            logger.warn({ err, userId: user.id }, "[Task] Auto-verification failed, falling back to manual review");
            initialStatus = TaskStatus.REVIEW;
            verificationStatus = "verification_error";
          }
        } else {
          // No verification task configured for this platform
          initialStatus = TaskStatus.REVIEW;
        }
      } else {
        // Platform not linked — manual review
        initialStatus = TaskStatus.REVIEW;
      }
    } else {
      // No verification provider for this platform (e.g., ARTICLE)
      initialStatus = TaskStatus.REVIEW;
    }

    const userTask = await userTaskRepository.upsert(user.id, taskId, {
      status: initialStatus,
      ip,
      userAgent,
      proof,
    });

    taskEventEmitter.emit("task.submitted", {
      userTaskId: userTask.id,
      userId: user.id,
      taskId,
      status: initialStatus,
    });

    analyzeFraudPatterns(user.id).catch((err) =>
      logger.error({ err, userId: user.id }, "[Task] Fraud analysis failed")
    );

    const message = initialStatus === TaskStatus.VERIFIED
      ? "Task auto-verified via platform verification"
      : "Task under manual review";

    return {
      id: userTask.id,
      status: userTask.status,
      verificationStatus,
      message,
    };
  },
};