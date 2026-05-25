import { prisma } from "../db/prisma";

/**
 * 🔍 Anti-Fraud Analyzer
 */
export const analyzeFraudPatterns = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { userTasks: true }
  });

  if (!user) return;

  const reviewTasks = user.userTasks.filter(t => t.status === "REVIEW").length;
  const totalTasks = user.userTasks.length;

  if (totalTasks > 5 && (reviewTasks / totalTasks) > 0.8) {
    await prisma.fraudLog.create({
      data: {
        userId,
        type: "PATTERN_SUSPICIOUS",
        severity: "MEDIUM",
        ip: user.lastIp,
        metadata: { reviewTasks, totalTasks }
      }
    });
    
    if (totalTasks > 10) {
      await prisma.user.update({
        where: { id: userId },
        data: { isBlocked: true }
      });
    }
  }
};
