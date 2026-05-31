import { prisma } from "@core/db/prisma";
import { Task, TaskPlatform, TaskType } from "@prisma/client";

export interface CreateTaskInput {
  title: string;
  description?: string;
  points: number;
  platform: TaskPlatform;
  type?: TaskType;
  url?: string;
  isActive?: boolean;
  maxSubmissions?: number;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  points?: number;
  platform?: TaskPlatform;
  type?: TaskType;
  url?: string | null;
  isActive?: boolean;
  maxSubmissions?: number;
}

export const taskRepository = {
  async create(data: CreateTaskInput): Promise<Task> {
    return prisma.task.create({ data });
  },

  async findById(id: string): Promise<Task | null> {
    return prisma.task.findUnique({ where: { id } });
  },

  async findAll(): Promise<Task[]> {
    return prisma.task.findMany({
      orderBy: { createdAt: "desc" },
    });
  },

  async findActive(): Promise<Task[]> {
    return prisma.task.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });
  },

  async update(id: string, data: UpdateTaskInput): Promise<Task> {
    return prisma.task.update({
      where: { id },
      data,
    });
  },

  async delete(id: string): Promise<Task> {
    return prisma.task.delete({ where: { id } });
  },

  async toggle(id: string): Promise<Task> {
    const task = await this.findById(id);
    if (!task) throw new Error("Task not found");
    return prisma.task.update({
      where: { id },
      data: { isActive: !task.isActive },
    });
  },
};
