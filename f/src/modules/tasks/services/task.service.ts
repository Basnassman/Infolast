import { getOrCreateUser } from "@modules/user/utils/user";
import { taskRepository } from "../repositories/task.repository";
import { userTaskRepository } from "@modules/user/repositories/user-task.repository";
import { taskEventEmitter } from "../events/task.events";
import { analyzeFraudPatterns } from "@modules/user/fraud/fraud-detector.service";

import { Task, TaskStatus } from "@prisma/client";

import { TaskNotFoundError } from "../errors/task-not-found.error";
import { TaskInactiveError } from "../errors/task-inactive.error";
import { TaskAlreadyCompletedError } from "../errors/task-already-completed.error";

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

    // جميع المهام تبدأ بالمراجعة اليدوية
    const initialStatus: TaskStatus = TaskStatus.REVIEW;

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

    analyzeFraudPatterns(user.id).catch(console.error);

    return {
      id: userTask.id,
      status: userTask.status,
      message: "Task under manual review",
    };
  },
};