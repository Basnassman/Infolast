import { prisma } from "@core/db/prisma";
import { VerificationPlatform, VerificationTask } from "@prisma/client";

export interface CreateVerificationTaskInput {
  title: string;
  description?: string;
  platform: VerificationPlatform;
  channelUrl?: string;
  channelIdentifier?: string;
  reward?: number;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}

export interface UpdateVerificationTaskInput {
  title?: string;
  description?: string;
  platform?: VerificationPlatform;
  channelUrl?: string;
  channelIdentifier?: string;
  reward?: number;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}

export const verificationTaskRepository = {
  async create(data: CreateVerificationTaskInput): Promise<VerificationTask> {
    return prisma.verificationTask.create({ data });
  },

  async findById(id: string): Promise<VerificationTask | null> {
    return prisma.verificationTask.findUnique({ where: { id } });
  },

  async findActive(): Promise<VerificationTask[]> {
    return prisma.verificationTask.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });
  },

  async findActiveByPlatform(platform: VerificationPlatform): Promise<VerificationTask[]> {
    return prisma.verificationTask.findMany({
      where: { isActive: true, platform },
      orderBy: { createdAt: "desc" },
    });
  },

  async findAll(): Promise<VerificationTask[]> {
    return prisma.verificationTask.findMany({
      orderBy: { createdAt: "desc" },
    });
  },

  async update(id: string, data: UpdateVerificationTaskInput): Promise<VerificationTask> {
    return prisma.verificationTask.update({ where: { id }, data });
  },

  async toggle(id: string): Promise<VerificationTask> {
    const task = await this.findById(id);
    if (!task) throw new Error(`Verification task not found: ${id}`);
    return prisma.verificationTask.update({
      where: { id },
      data: { isActive: !task.isActive },
    });
  },

  async delete(id: string): Promise<void> {
    await prisma.verificationTask.delete({ where: { id } });
  },
};
