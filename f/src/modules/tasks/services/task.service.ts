import { Task, TaskStatus } from "@prisma/client";
import { taskRepository } from "../repositories/task.repository";
import { userTaskRepository } from "../repositories/user-task.repository";
import { userService } from "@modules/user/services/user.service";
import { taskEventEmitter } from "../events/task.events";
import { riskEngine } from "@modules/user/risk/risk-engine.service";
import { fraudDetector } from "@modules/user/fraud/fraud-detector.service";
import { taskAdminService } from "./task-admin.service";

export interface SubmitTaskPayload {
  walletAddress: string;
  taskId: string;
  ip?: string;
  userAgent?: string;
  proof?: Record<string, any>;
}

export const taskService = {
  async getAvailableTasks(walletAddress: string): Promise<Task[]> {
    const user = await userService.findByWallet(walletAddress);
    if (!user) return [];

    const tasks = await taskRepository.findActive();
    const userTasks = await userTaskRepository.findByUser(user.id);

    return tasks.filter((task) => {
      const submissions = userTasks.filter((ut) => ut.taskId === task.id).length;
      return submissions < task.maxSubmissions;
    });
  },

  async getUserTaskHistory(walletAddress: string): Promise<any[]> {
    const user = await userService.findByWallet(walletAddress);
    if (!user) return [];

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
      task: ut.task,
    }));
  },

  async submitTask(payload: SubmitTaskPayload): Promise<any> {
    const { walletAddress, taskId, ip, userAgent, proof } = payload;

    const user = await userService.findByWallet(walletAddress);
    if (!user) throw new Error("User not found");

    const task = await taskRepository.findById(taskId);
    if (!task) throw new Error("Task not found");
    if (!task.isActive) throw new Error("Task is not active");

    const existing = await userTaskRepository.findByUserAndTask(user.id, taskId);
    if (existing && existing.status === TaskStatus.VERIFIED) {
      throw new Error("Task already completed");
    }

    const riskResult = await riskEngine.analyzeRisk(user.id, ip, userAgent);

    if (riskResult.action === "REJECT") {
      throw new Error("Task rejected by risk engine");
    }

    const initialStatus: TaskStatus =
      riskResult.action === "REVIEW" ? TaskStatus.REVIEW : TaskStatus.PENDING;

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

    if (initialStatus === TaskStatus.PENDING && riskResult.score < 30) {
      return taskAdminService.approveTask(userTask.id, "SYSTEM_AUTO");
    }

    fraudDetector.analyzeFraudPatterns(user.id).catch(console.error);

    return {
      id: userTask.id,
      status: userTask.status,
      message:
        initialStatus === TaskStatus.REVIEW
          ? "Task under manual review"
          : "Task submitted successfully",
    };
  },
};
