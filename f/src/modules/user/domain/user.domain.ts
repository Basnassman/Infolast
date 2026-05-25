import {
  DistributionType,
  RiskLevel,
  UserStatus,
} from "@prisma/client";

/**
 * =====================================================
 * USER DOMAIN TYPES
 * =====================================================
 */

export type UserDomain = {
  id: string;

  walletAddress: string;

  email?: string | null;

  username?: string | null;

  status: UserStatus;

  createdAt: Date;

  updatedAt: Date;

  // ---------------------------------
  // Airdrop
  // ---------------------------------

  airdrop?: {
    participantId: string;

    points: number;

    allocationWei: string;

    isEligible: boolean;

    lastCalculatedAt?: Date | null;
  } | null;

  // ---------------------------------
  // Purchases
  // ---------------------------------

  purchases: {
    totalSpentUsd: number;

    totalTokenReceivedWei: string;

    totalPurchases: number;
  };

  // ---------------------------------
  // Vesting
  // ---------------------------------

  vesting: {
    totalVestedWei: string;

    totalReleasedWei: string;

    totalClaimableWei: string;
  };

  // ---------------------------------
  // Risk
  // ---------------------------------

  risk?: {
    level: RiskLevel;

    score: number;

    isSybilSuspected: boolean;
  } | null;
};

export type UserMerkleData = {
  distributionType: DistributionType;

  merkleRoot: string;

  merkleProof: string[];

  leaf: string;

  amountWei: string;

  createdAt: Date;
};

export type UserSummary = {
  walletAddress: string;

  status: UserStatus;

  powerScore: number;

  totalTokenBalanceWei: string;

  airdrop: {
    eligible: boolean;

    points: number;

    allocationWei: string;
  } | null;

  purchases: {
    totalSpentUsd: number;

    totalTokenReceivedWei: string;

    totalPurchases: number;
  };

  vesting: {
    totalVestedWei: string;

    totalReleasedWei: string;

    totalClaimableWei: string;
  };

  risk: {
    level: RiskLevel;

    score: number;

    isSybilSuspected: boolean;
  } | null;
};

/**
 * =====================================================
 * DOMAIN HELPERS
 * =====================================================
 */

/**
 * Check if user can participate in airdrop
 */
export const isEligibleForAirdrop = (
  user: UserDomain
): boolean => {
  return Boolean(
    user.status === UserStatus.ACTIVE &&
      user.airdrop &&
      user.airdrop.isEligible &&
      BigInt(
        user.airdrop.allocationWei || "0"
      ) > 0n
  );
};

/**
 * Calculate user power score
 */
export const calculateUserPower = (
  user: UserDomain
): number => {
  const points =
    user.airdrop?.points || 0;

  const spent =
    user.purchases.totalSpentUsd;

  return points + spent * 10;
};

/**
 * Calculate total token balance
 */
export const calculateTotalTokensWei = (
  user: UserDomain
): string => {
  const airdrop =
    BigInt(
      user.airdrop?.allocationWei || "0"
    );

  const purchased =
    BigInt(
      user.purchases
        .totalTokenReceivedWei || "0"
    );

  const vested =
    BigInt(
      user.vesting.totalVestedWei || "0"
    );

  return (
    airdrop +
    purchased +
    vested
  ).toString();
};

/**
 * Build user summary object
 */
export const getUserSummary = (
  user: UserDomain
): UserSummary => {
  return {
    walletAddress:
      user.walletAddress,

    status: user.status,

    powerScore:
      calculateUserPower(user),

    totalTokenBalanceWei:
      calculateTotalTokensWei(user),

    airdrop: user.airdrop
      ? {
          eligible:
            user.airdrop.isEligible,

          points:
            user.airdrop.points,

          allocationWei:
            user.airdrop.allocationWei,
        }
      : null,

    purchases: user.purchases,

    vesting: user.vesting,

    risk: user.risk
      ? {
          level:
            user.risk.level,

          score:
            user.risk.score,

          isSybilSuspected:
            user.risk
              .isSybilSuspected,
        }
      : null,
  };
};