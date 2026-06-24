import { prisma } from "@core/db/prisma";
import { VerificationAction, VerificationResultStatus } from "@prisma/client";

export interface CreateVerificationLogInput {
  userId: string;
  verificationTaskId: string;
  userVerificationTaskId?: string;
  action: VerificationAction;
  result: VerificationResultStatus;
  details?: Record<string, unknown>;
}

export const verificationLogRepository = {
  async create(data: CreateVerificationLogInput) {
    return prisma.verificationLog.create({ data });
  },

  async findByUser(userId: string, limit = 50) {
    return prisma.verificationLog.findMany({
      where: { userId },
      include: { verificationTask: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },

  async findByUserAndTask(userId: string, verificationTaskId: string, limit = 20) {
    return prisma.verificationLog.findMany({
      where: { userId, verificationTaskId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },

  async findRecent(limit = 100) {
    return prisma.verificationLog.findMany({
      include: { user: true, verificationTask: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },

  async countByAction(action: VerificationAction): Promise<number> {
    return prisma.verificationLog.count({ where: { action } });
  },

  async countByResult(result: VerificationResultStatus): Promise<number> {
    return prisma.verificationLog.count({ where: { result } });
  },

  async findRecentByUser(userId: string, since: Date) {
    return prisma.verificationLog.findMany({
      where: {
        userId,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
    });
  },
};
