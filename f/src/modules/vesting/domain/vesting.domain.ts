/**
 * =====================================================
 * VESTING DOMAIN
 * =====================================================
 *
 * Pure functions for deriving user classification
 * from database relations.
 *
 * Classification is NOT stored in the database.
 * It is computed on-the-fly from existing relations:
 *   - Has AirdropParticipant? → Participant
 *   - Has VestingSchedule? → Buyer
 *   - Both? → Buyer + Participant
 *
 * The blockchain remains the Source of Truth for all
 * vesting calculations (releasable, vested, etc.).
 */

import { ParticipantClassification, VestingParticipantProfile, VestingAnalytics, ClaimStatus } from "@modules/vesting/types/vesting.types";
import { VestingSchedule, VestingClaimEvent, VestingSource } from "@prisma/client";

/**
 * =====================================================
 * USER CLASSIFICATION
 * =====================================================
 *
 * Derives classification from existing relations.
 * No data is stored — this is computed from:
 *   - AirdropParticipant (has airdrop participant?)
 *   - VestingSchedule (has vesting schedule from purchase?)
 */

export const classifyParticipant = (
  hasAirdropParticipant: boolean,
  hasVestingSchedule: boolean
): ParticipantClassification => {
  if (hasAirdropParticipant && hasVestingSchedule) {
    return "BUYER_PARTICIPANT";
  }
  if (hasVestingSchedule) {
    return "BUYER_ONLY";
  }
  return "PARTICIPANT_ONLY";
};

/**
 * =====================================================
 * CLAIM STATUS
 * =====================================================
 *
 * Derives claim status from tracking fields.
 */

export const deriveClaimStatus = (
  totalAllocatedWei: string,
  totalClaimedWei: string,
  claimCount: number
): ClaimStatus => {
  if (claimCount === 0) return "NOT_STARTED";

  const allocated = BigInt(totalAllocatedWei);
  const claimed = BigInt(totalClaimedWei);

  if (claimed >= allocated && allocated > 0n) {
    return "COMPLETED";
  }

  return "PARTIAL";
};

/**
 * =====================================================
 * PROGRESS CALCULATION
 * =====================================================
 *
 * Calculates claim progress as percentage (0-100).
 */

export const calculateProgress = (
  totalAllocatedWei: string,
  totalClaimedWei: string
): number => {
  const allocated = BigInt(totalAllocatedWei);
  if (allocated === 0n) return 0;

  const claimed = BigInt(totalClaimedWei);
  return Number((claimed * 100n) / allocated);
};

/**
 * =====================================================
 * REMAINING AMOUNT
 * =====================================================
 */

export const calculateRemaining = (
  totalAllocatedWei: string,
  totalClaimedWei: string
): string => {
  const allocated = BigInt(totalAllocatedWei);
  const claimed = BigInt(totalClaimedWei);

  if (claimed >= allocated) return "0";

  return (allocated - claimed).toString();
};

/**
 * =====================================================
 * BUILD PARTICIPANT PROFILE
 * =====================================================
 *
 * Builds a full participant profile from a VestingSchedule
 * record. Classification must be provided externally
 * (computed from relations).
 */

export const buildParticipantProfile = (
  schedule: VestingSchedule & {
    claimEvents: VestingClaimEvent[];
  },
  classification: ParticipantClassification
): VestingParticipantProfile => {
  const status = deriveClaimStatus(
    schedule.totalAllocatedWei,
    schedule.totalClaimedWei,
    schedule.claimCount
  );

  const progress = calculateProgress(
    schedule.totalAllocatedWei,
    schedule.totalClaimedWei
  );

  const remainingWei = calculateRemaining(
    schedule.totalAllocatedWei,
    schedule.totalClaimedWei
  );

  return {
    walletAddress: schedule.userId,
    source: schedule.source,
    totalAllocatedWei: schedule.totalAllocatedWei,
    totalClaimedWei: schedule.totalClaimedWei,
    remainingWei,
    status,
    progress,
    lastClaimedAt: schedule.lastClaimedAt,
    claimCount: schedule.claimCount,
    lastClaimTxHash: schedule.lastClaimTxHash,
    classification,
  };
};

/**
 * =====================================================
 * COMPUTE ANALYTICS
 * =====================================================
 *
 * Computes analytics from raw database results.
 * Used by admin dashboard.
 */

export const computeAnalytics = (data: {
  totals: {
    totalParticipants: number;
    totalAllocatedWei: string;
    totalClaimedWei: string;
  };
  neverClaimed: number;
  fullyClaimed: number;
  bySource: Array<{
    source: string;
    count: number;
    totalAllocatedWei: string;
    totalClaimedWei: string;
  }>;
  classifications: {
    participantOnly: number;
    buyerOnly: number;
    buyerParticipant: number;
  };
}): VestingAnalytics => {
  const totalRemainingWei = calculateRemaining(
    data.totals.totalAllocatedWei,
    data.totals.totalClaimedWei
  );

  return {
    totalParticipants: data.totals.totalParticipants,
    totalAllocatedWei: data.totals.totalAllocatedWei,
    totalClaimedWei: data.totals.totalClaimedWei,
    totalRemainingWei,
    notStarted: data.neverClaimed,
    partial: data.totals.totalParticipants - data.neverClaimed - data.fullyClaimed,
    completed: data.fullyClaimed,
    bySource: data.bySource.map((s) => ({
      source: s.source as VestingSource,
      count: s.count,
      totalAllocatedWei: s.totalAllocatedWei,
      totalClaimedWei: s.totalClaimedWei,
    })),
    classifications: data.classifications,
  };
};
