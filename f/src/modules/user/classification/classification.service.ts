import { prisma } from "@core/db/prisma";
import { RiskLevel } from "@prisma/client";

/**
 * =====================================================
 * USER CLASSIFICATION SERVICE
 * =====================================================
 */

export type UserClassification = {
  powerScore: number;

  totalSpentUsd: number;

  totalPurchasedWei: string;

  airdropPoints: number;

  riskLevel: RiskLevel | null;

  tags: string[];
};

/**
 * Calculate user power score
 */
export const calculatePowerScore = (
  airdropPoints: number,
  totalSpentUsd: number
): number => {
  return (
    airdropPoints +
    totalSpentUsd * 10
  );
};

/**
 * Build user tags
 */
export const buildUserTags = (
  params: {
    hasAirdrop: boolean;
    hasPurchases: boolean;
    totalSpentUsd: number;
    riskLevel?: RiskLevel | null;
  }
): string[] => {
  const tags: string[] = [];

  // =====================================
  // Participation tags
  // =====================================

  if (
    params.hasAirdrop &&
    params.hasPurchases
  ) {
    tags.push("AIRDROP_BUYER");
  } else if (params.hasAirdrop) {
    tags.push("AIRDROP_ONLY");
  } else if (params.hasPurchases) {
    tags.push("BUYER_ONLY");
  } else {
    tags.push("INACTIVE");
  }

  // =====================================
  // Whale tags
  // =====================================

  if (params.totalSpentUsd >= 100000) {
    tags.push("WHALE");
  } else if (
    params.totalSpentUsd >= 10000
  ) {
    tags.push("VIP");
  }

  // =====================================
  // Risk tags
  // =====================================

  if (
    params.riskLevel ===
      RiskLevel.HIGH ||
    params.riskLevel ===
      RiskLevel.CRITICAL
  ) {
    tags.push("HIGH_RISK");
  }

  return tags;
};

/**
 * Update user classification
 */
export const updateUserClassification =
  async (userId: string) => {
    // =====================================
    // Load user relations
    // =====================================

    const user =
      await prisma.user.findUnique({
        where: { id: userId },

        include: {
          airdropParticipant: true,

          purchases: true,

          riskProfile: true,

          tags: true,
        },
      });

    if (!user) {
      throw new Error(
        "User not found"
      );
    }

    // =====================================
    // Calculate purchase totals
    // =====================================

    const totalSpentUsd =
      user.purchases.reduce(
        (sum, purchase) =>
          sum +
          Number(
            purchase.tokenPriceUsd || 0
          ),
        0
      );

    const totalPurchasedWei =
      user.purchases
        .reduce(
          (sum, purchase) =>
            sum +
            BigInt(
              purchase.tokenReceivedWei
            ),
          0n
        )
        .toString();

    // =====================================
    // Airdrop points
    // =====================================

    const airdropPoints =
      user.airdropParticipant
        ?.points || 0;

    // =====================================
    // Power score
    // =====================================

    const powerScore =
      calculatePowerScore(
        airdropPoints,
        totalSpentUsd
      );

    // =====================================
    // Generate tags
    // =====================================

    const newTags =
      buildUserTags({
        hasAirdrop:
          airdropPoints > 0,

        hasPurchases:
          user.purchases.length > 0,

        totalSpentUsd,

        riskLevel:
          user.riskProfile
            ?.riskLevel,
      });

    // =====================================
    // Replace existing tags
    // =====================================

    await prisma.userTag.deleteMany({
      where: {
        userId,
      },
    });

    if (newTags.length > 0) {
      await prisma.userTag.createMany({
        data: newTags.map((tag) => ({
          userId,
          tag,
        })),
      });
    }

    return {
      userId,

      powerScore,

      totalSpentUsd,

      totalPurchasedWei,

      airdropPoints,

      riskLevel:
        user.riskProfile
          ?.riskLevel || null,

      tags: newTags,
    } satisfies UserClassification;
  };