import { prisma } from "../../../core/db/prisma";
import { RiskLevel, UserStatus } from "@prisma/client";

/**
 * 🔍 Fraud Pattern Analyzer
 *
 * New architecture:
 * - Uses UserRiskProfile
 * - Uses UserAuditLog
 * - No legacy fraudLog table
 * - No userTasks dependency
 */

export const analyzeFraudPatterns = async (
  userId: string
) => {
  const user =
    await prisma.user.findUnique({
      where: { id: userId },
      include: {
        riskProfile: true,
        airdropParticipant: true,
      },
    });

  if (!user) {
    return;
  }

  let riskScore = 0;
  let riskLevel = RiskLevel.LOW;
  let isSybilSuspected = false;
  const notes: string[] = [];

  // =========================================
  // 1. Suspicious airdrop farming
  // =========================================

  if (
    user.airdropParticipant &&
    user.airdropParticipant.points > 100000
  ) {
    riskScore += 40;

    notes.push(
      "Abnormally high airdrop points"
    );
  }

  // =========================================
  // 2. Rapid purchases
  // =========================================

  const recentPurchases =
    await prisma.purchase.count({
      where: {
        userId,
        createdAt: {
          gte: new Date(
            Date.now() - 5 * 60 * 1000
          ),
        },
      },
    });

  if (recentPurchases >= 10) {
    riskScore += 30;

    notes.push(
      "High purchase frequency detected"
    );
  }

  // =========================================
  // 3. Multi-wallet suspicion
  // =========================================

  const sameCreatedWindow =
    await prisma.user.count({
      where: {
        createdAt: {
          gte: new Date(
            user.createdAt.getTime() -
              60 * 1000
          ),
          lte: new Date(
            user.createdAt.getTime() +
              60 * 1000
          ),
        },
      },
    });

  if (sameCreatedWindow >= 20) {
    riskScore += 50;

    isSybilSuspected = true;

    notes.push(
      "Possible sybil wallet cluster"
    );
  }

  // =========================================
  // Determine risk level
  // =========================================

  if (riskScore >= 80) {
    riskLevel = RiskLevel.CRITICAL;
  } else if (riskScore >= 60) {
    riskLevel = RiskLevel.HIGH;
  } else if (riskScore >= 30) {
    riskLevel = RiskLevel.MEDIUM;
  }

  // =========================================
  // Update risk profile
  // =========================================

  await prisma.userRiskProfile.upsert({
    where: {
      userId,
    },
    update: {
      riskLevel,
      riskScore,
      isSybilSuspected,
      notes: notes.join(" | "),
      updatedAt: new Date(),
    },
    create: {
      userId,
      riskLevel,
      riskScore,
      isSybilSuspected,
      notes: notes.join(" | "),
    },
  });

  // =========================================
  // Auto block critical users
  // =========================================

  if (riskLevel === RiskLevel.CRITICAL) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        status: UserStatus.BLOCKED,
      },
    });

    await prisma.userAuditLog.create({
      data: {
        userId,
        action: "USER_AUTO_BLOCKED",
        metadata: {
          riskScore,
          notes,
        },
      },
    });
  }

  return {
    riskScore,
    riskLevel,
    isSybilSuspected,
    notes,
  };
};