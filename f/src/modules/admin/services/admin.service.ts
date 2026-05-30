import { prisma } from "@core/db/prisma";
import { DistributionType } from "@prisma/client";

export const getMerkleJobs = async () => {
  return prisma.merkleJob.findMany({
    where: {
      distributionType: DistributionType.AIRDROP,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 50,
  });
};

export const taskAdminService = {
  async createTask(data: CreateTaskInput): Promise<Task> {
    const task = await taskRepository.create(data);
    taskEventEmitter.emit("task.created", { taskId: task.id });
    return task;
  },

  async updateTask(id: string, data: UpdateTaskInput): Promise<Task> {
    const task = await taskRepository.update(id, data);
    taskEventEmitter.emit("task.updated", { taskId: task.id });
    return task;
  },

  async deleteTask(id: string): Promise<Task> {
    const task = await taskRepository.delete(id);
    taskEventEmitter.emit("task.deleted", { taskId: task.id });
    return task;
  },

  async getAllTasks(): Promise<Task[]> {
    return taskRepository.findAll();
  },

  async toggleTask(id: string): Promise<Task> {
    const task = await taskRepository.toggle(id);
    taskEventEmitter.emit("task.toggled", { taskId: task.id, isActive: task.isActive });
    return task;
  },

  async approveTask(userTaskId: string, reviewedBy: string): Promise<any> {
    const userTask = await userTaskRepository.findById(userTaskId);
    if (!userTask) throw new Error("UserTask not found");
    if (userTask.status === TaskStatus.VERIFIED) {
      throw new Error("Task already approved");
    }

    const updated = await userTaskRepository.update(userTaskId, {
      status: TaskStatus.VERIFIED,
      completedAt: new Date(),
      reviewedAt: new Date(),
      reviewedBy,
    });

    const rewardResult = await distributeReward(
      userTask.userId,
      userTask.taskId,
      userTask.task.points
    );

    await userTaskRepository.update(userTaskId, {
      points: rewardResult.points,
      rewardGiven: rewardResult.success,
    });

    taskEventEmitter.emit("task.approved", {
      userTaskId,
      userId: userTask.userId,
      taskId: userTask.taskId,
      points: rewardResult.points,
    });

    return {
      id: updated.id,
      status: TaskStatus.VERIFIED,
      points: rewardResult.points,
      totalPoints: rewardResult.totalPoints,
      rewardGiven: rewardResult.success,
    };
  },

  async rejectTask(userTaskId: string, reviewedBy: string): Promise<any> {
    const userTask = await userTaskRepository.findById(userTaskId);
    if (!userTask) throw new Error("UserTask not found");

    const updated = await userTaskRepository.update(userTaskId, {
      status: TaskStatus.REJECTED,
      reviewedAt: new Date(),
      reviewedBy,
    });

    taskEventEmitter.emit("task.rejected", {
      userTaskId,
      userId: userTask.userId,
      taskId: userTask.taskId,
    });

    return {
      id: updated.id,
      status: TaskStatus.REJECTED,
    };
  },

  async getReviewQueue(): Promise<any[]> {
    const queue = await userTaskRepository.findPendingReview();
    return queue.map((ut) => ({
      id: ut.id,
      user: {
        wallet: ut.user.walletAddress,
        riskScore: ut.user.riskProfile?.riskScore || 0,
      },
      task: {
        title: ut.task.title,
        platform: ut.task.platform,
        points: ut.task.points,
      },
      status: ut.status,
      completedAt: ut.createdAt.toISOString(),
      ip: ut.ip,
      userAgent: ut.userAgent,
    }));
  },
};
