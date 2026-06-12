import {
  DistributionType,
  UserStatus,
} from "@prisma/client";

export interface ParticipantUser {
  id: string;

  walletAddress: string;

  status: UserStatus;

  createdAt: Date;
}

export interface AirdropParticipantView {
  id: string;

  userId: string;

  points: number;

  allocationWei: string;

  isEligible: boolean;

  airdropDirty: boolean;

  lastCalculatedAt: Date | null;

  createdAt: Date;

  updatedAt: Date;

  user: ParticipantUser;
}

export interface AllocationResult {
  eligible: boolean;

  allocationWei: string;

  allocationTokens: string;
  points?: number;        // ← أضف
  multiplier?: number; 

  reason?: string | null;
}

export interface EligibilityResult {
  eligible: boolean;
  reason?: string | null;
}

export interface MerkleEntry {
  walletAddress: string;

  amountWei: string;
}

export interface MerkleProofRecord {
  walletAddress: string;

  leaf: string;

  proof: string[];

  amountWei: string;
}

export interface MerkleSnapshot {
  root: string;

  eligibleCount: number;

  totalAmountWei: string;

  entries: MerkleEntry[];

  proofs: MerkleProofRecord[];
}

export interface CreateMerkleRootInput {
  distributionType?: DistributionType;

  root: string;

  eligibleCount: number;

  totalAmountWei: string;

  ipfsSnapshotUrl?: string | null;
}

export interface AllocationInput {
  walletAddress: string;
  points: number;
  totalPurchasedUsd?: number;  // للـ multiplier
}
