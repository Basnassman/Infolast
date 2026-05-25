import { DistributionType } from "@prisma/client";

export interface AllocationInput {
  walletAddress: string;
  points: number;
  totalPurchasedUsd?: number;
}

export interface AllocationResult {
  eligible: boolean;

  points: number;

  allocationTokens: string;

  allocationWei: string;

  multiplier: number;

  reason?: string | null;
}

export interface EligibilityResult {
  eligible: boolean;
  reason?: string;
}

export interface AirdropParticipantView {
  id: string;

  userId: string;

  walletAddress: string;

  points: number;

  allocationWei: string;

  isEligible: boolean;

  airdropDirty: boolean;

  lastCalculatedAt: Date | null;
}

export interface DistributionSnapshotResult {
  distributionType: DistributionType;

  totalUsers: number;

  totalAmountWei: string;

  snapshotVersion: number;
}