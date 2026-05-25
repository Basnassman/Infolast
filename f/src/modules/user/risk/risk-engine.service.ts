import { prisma } from "../../../core/db/prisma";
import {
  RiskLevel,
  UserStatus,
} from "@prisma/client";

export interface RiskResult {
  score: number;

  level: RiskLevel;

  reasons: string[];

  action:
    | "ALLOW"
    | "REVIEW"
    | "REJECT";
}

/**
 * =====================================================
 * RISK ENGINE
 * =====================================================
 */

export const analyzeRisk = async (
  userId: string,
  ip: string,
  userAgent?: string
): Promise<RiskResult> => {
  let score = 0;

  const reasons: string[] = [];

  // =====================================
  // Load user
  // =====================================

  const user =
    await prisma.user.findUnique({
      where: { id: userId },

      include: {
        purchases: true,
        airdropParticipant: true,
      },
    });

  if (!user) {
    throw new Error(
      "User not found"
    );
  }

  // =====================================
  // Blocked users
  // =====================================

  if (
    user.status ===
      UserStatus.BLOCKED ||
    user.status ===
      UserStatus.SUSPENDED
  ) {
    return {
      score: 100,

      level:
        RiskLevel.CRITICAL,

      reasons: [
        "Blocked or suspended user",
      ],

      action: "REJECT",
    };
  }

  // =====================================
  // New wallet check
  // =====================================

  const accountAgeMs =
    Date.now() -
    user.createdAt.getTime();

  if (
    accountAgeMs <
    1000 * 60 * 60
  ) {
    score += 10;

    reasons.push(
      "New wallet account"
    );
  }

  // =====================================
  // Suspicious user-agent
  // =====================================

  if (
    !userAgent ||
    userAgent.includes(
      "Headless"
    ) ||
    userAgent.includes("bot")
  ) {
    score += 25;

    reasons.push(
      "Suspicious user agent"
    );
  }

  // =====================================
  // Excessive purchases
  // =====================================

  const recentPurchases =
    await prisma.purchase.count({
      where: {
        userId,

        createdAt: {
          gte: new Date(
            Date.now() -
              60 * 1000
          ),
        },
      },
    });

  if (recentPurchases > 5) {
    score += 20;

    reasons.push(
      "High purchase velocity"
    );
  }

  // =====================================
  // Abnormal airdrop farming
  // =====================================

  if (
    user.airdropParticipant &&
    user.airdropParticipant
      .points > 100000
  ) {
    score += 35;

    reasons.push(
      "Suspicious airdrop activity"
    );
  }

  // =====================================
  // Determine risk level
  // =====================================

  let level =
    RiskLevel.LOW;

  let action:
    | "ALLOW"
    | "REVIEW"
    | "REJECT" = "ALLOW";

  if (score >= 80) {
    level =
      RiskLevel.CRITICAL;

    action = "REJECT";
  } else if (score >= 50) {
    level =
      RiskLevel.HIGH;

    action = "REVIEW";
  } else if (score >= 25) {
    level =
      RiskLevel.MEDIUM;

    action = "REVIEW";
  }

  // =====================================
  // Persist profile
  // =====================================

  await prisma.userRiskProfile.upsert({
    where: {
      userId,
    },

    update: {
      riskLevel: level,

      riskScore: score,

      notes:
        reasons.join(" | "),

      reviewedAt:
        new Date(),
    },

    create: {
      userId,

      riskLevel: level,

      riskScore: score,

      notes:
        reasons.join(" | "),

      reviewedAt:
        new Date(),
    },
  });

  return {
    score,
    level,
    reasons,
    action,
  };
};