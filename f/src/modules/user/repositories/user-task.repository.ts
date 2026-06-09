import { prisma } from "@core/db/prisma";
import { UserTask, TaskStatus } from "@prisma/client";
import { UserTaskNotFoundError } from "@modules/user/errors/user-task-not-found.error";

export interface CreateUserTaskInput {
  userId: string;
  taskId: string;
  status?: TaskStatus;
  ip?: string;
  userAgent?: string;
  proof?: Record<string, any>;
}

export interface UpdateUserTaskInput {
  status?: TaskStatus;
  rewardGiven?: boolean;
  points?: number;
  completedAt?: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
}

export const userTaskRepository = {
  async create(data: CreateUserTaskInput): Promise<UserTask> {
    return prisma.userTask.create({ data });
  },

  async findById(id: string): Promise<any> {
  return prisma.userTask.findUnique({
    where: { id },
    include: {
      user: {
        include: {
          riskProfile: true,
        },
      },
      task: true,
    },
  });
  },

  async findByUserAndTask(userId: string, taskId: string): Promise<UserTask | null> {
    return prisma.userTask.findUnique({
      where: { userId_taskId: { userId, taskId } },
      include: { task: true },
    });
  },

  async findByUser(userId: string): Promise<UserTask[]> {
    return prisma.userTask.findMany({
      where: { userId },
      include: { task: true },
      orderBy: { createdAt: "desc" },
    });
  },

  async findPendingReview(): Promise<any[]> {
  return prisma.userTask.findMany({
    where: { status: TaskStatus.REVIEW },
    include: {
      user: {
        include: {
          riskProfile: true,
        },
      },
      task: true,
    },
    orderBy: { createdAt: "desc" },
  });
  },

  async upsert(userId: string, taskId: string, data: Partial<CreateUserTaskInput>): Promise<UserTask> {
    return prisma.userTask.upsert({
      where: { userId_taskId: { userId, taskId } },
      create: {
        userId,
        taskId,
        status: data.status || TaskStatus.PENDING,
        ip: data.ip,
        userAgent: data.userAgent,
        proof: data.proof,
      },
      update: {
        status: data.status || TaskStatus.PENDING,
        ip: data.ip,
        userAgent: data.userAgent,
        proof: data.proof,
      },
      include: { task: true },
    });
  },

  async update(id: string, data: UpdateUserTaskInput): Promise<UserTask> {
    return prisma.userTask.update({
      where: { id },
      data,
      include: { task: true },
    });
  },

  async updateByUserAndTask(
    userId: string,
    taskId: string,
    data: UpdateUserTaskInput): 
    Promise<UserTask> {
    const userTask = await this.findByUserAndTask(userId, taskId);
    

  if (!userTask) {
    throw new UserTaskNotFoundError(userId, taskId);
  }
    return this.update(userTask.id, data);
  },

  async countByUserAndStatus(userId: string, status: TaskStatus): Promise<number> {
    return prisma.userTask.count({
      where: { userId, status },
    });
  },

  async countByTask(taskId: string): Promise<number> {
    return prisma.userTask.count({ where: { taskId } });
  },
};