import { prisma } from "../../../core/db/prisma";

/**
 * 📝 Audit Logger
 *
 * New architecture:
 * - Uses UserAuditLog
 * - userId references actual User.id
 * - No wallet-based audit relation
 */

export interface AuditLogInput {
  userId: string;
  action: string;
  metadata?: any;
}

/**
 * Create audit log
 */
export const logAction = async (
  data: AuditLogInput
) => {
  return prisma.userAuditLog.create({
    data: {
      userId: data.userId,
      action: data.action,
      metadata: data.metadata ?? {},
    },
  });
};

/**
 * Get audit logs by user ID
 */
export const getUserAuditLogs = async (
  userId: string,
  limit: number = 50
) => {
  return prisma.userAuditLog.findMany({
    where: {
      userId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
  });
};

/**
 * Get latest audit events
 */
export const getLatestAuditLogs = async (
  limit: number = 100
) => {
  return prisma.userAuditLog.findMany({
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
    include: {
      user: {
        select: {
          walletAddress: true,
          status: true,
        },
      },
    },
  });
};