import { prisma } from "../db/prisma";

export interface RiskResult {
  score: number;
  reasons: string[];
  action: "ALLOW" | "REVIEW" | "REJECT";
}

/**
 * 🧠 Risk Engine Service
 */
export const analyzeRisk = async (userId: string, ip: string, userAgent?: string): Promise<RiskResult> => {
  let score = 0;
  const reasons: string[] = [];

  // 1. IP Multi-wallet Detection
  const ipUsage = await prisma.user.count({
    where: { 
      lastIp: ip, 
      NOT: { id: userId } 
    }
  });
  if (ipUsage > 2) {
    score += 40;
    reasons.push("Multiple wallets detected on same IP");
  }

  // 2. Velocity Check
  const recentTasksCount = await prisma.userTask.count({
    where: { 
      userId: userId, 
      completedAt: { gte: new Date(Date.now() - 60000) } 
    }
  });
  if (recentTasksCount > 3) {
    score += 20;
    reasons.push("High task completion velocity");
  }

  // 3. New Wallet Check
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user) {
    const isNewWallet = (Date.now() - user.createdAt.getTime() < 3600000);
    if (isNewWallet) {
      score += 10;
      reasons.push("New wallet account");
    }
  }

  // 4. Suspicious User-Agent
  if (userAgent?.includes("Headless") || !userAgent) {
    score += 30;
    reasons.push("Suspicious browser/user-agent");
  }

  let action: "ALLOW" | "REVIEW" | "REJECT" = "ALLOW";
  if (score > 70) action = "REJECT";
  else if (score >= 30) action = "REVIEW";

  return { score, reasons, action };
};
