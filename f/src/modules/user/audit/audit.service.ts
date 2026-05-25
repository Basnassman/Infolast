import { prisma } from "../db/prisma";

/**
 * 📝 Log an action to the audit log
 */
export const logAction = async (data: {
  action: string;
  userId?: string;
  txHash?: string;
  ip?: string;
  metadata?: any;
}) => {
  await prisma.auditLog.create({
    data: {
      action: data.action,
      userId: data.userId?.toLowerCase(),
      txHash: data.txHash,
      ip: data.ip,
      metadata: data.metadata || {},
    },
  });
};

/**
 * 📊 Get audit logs for a user
 */
export const getUserAuditLogs = async (wallet: string, limit: number = 50) => {
  return prisma.auditLog.findMany({
    where: { userId: wallet.toLowerCase() },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
};
