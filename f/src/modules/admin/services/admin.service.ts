import { prisma } from "@core/db/prisma";
import { DistributionType, TaskStatus } from "@prisma/client";
import { taskRepository } from "@modules/tasks/repositories/task.repository";
import { userTaskRepository } from "@modules/user/repositories/user-task.repository";
import { distributeReward } from "@modules/tasks/rewards/reward.service";
import { taskEventEmitter } from "@modules/tasks/events/task.events";

// ─── Merkle Jobs ────────────────────────────────────────────────────────────

export const getMerkleJobs = async () => {
  return prisma.merkleJob.findMany({
    where: { distributionType: DistributionType.AIRDROP },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
};

// ─── Task Management ────────────────────────────────────────────────────────

export const createTask = async (data: any) => {
  const task = await taskRepository.create(data);
  taskEventEmitter.emit("task.created", { taskId: task.id });
  return task;
};

export const updateTask = async (id: string, data: any) => {
  const task = await taskRepository.update(id, data);
  taskEventEmitter.emit("task.updated", { taskId: task.id });
  return task;
};

export const deleteTask = async (id: string) => {
  const task = await taskRepository.delete(id);
  taskEventEmitter.emit("task.deleted", { taskId: task.id });
  return task;
};

export const getAllTasks = async () => {
  return taskRepository.findAll();
};

export const toggleTask = async (id: string) => {
  const task = await taskRepository.toggle(id);
  taskEventEmitter.emit("task.toggled", { taskId: task.id, isActive: task.isActive });
  return task;
};

export const approveTask = async (userTaskId: string, reviewedBy: string) => {
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
};

export const rejectTask = async (userTaskId: string, reviewedBy: string) => {
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
};

export const getReviewQueue = async () => {
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
};
