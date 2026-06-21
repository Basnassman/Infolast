import { VestingSource } from "@prisma/client";

/**
 * =====================================================
 * RAW BLOCKCHAIN EVENTS
 * =====================================================
 *
 * Matches Vesting.sol event signatures:
 *   Allocated(address user, uint256 amount)
 *   Claimed(address user, uint256 amount)
 */

export type RawAllocatedEvent = {
  user: string;
  amount: bigint;
  txHash: string;
  blockNumber: number;
  blockHash: string;
  logIndex: number;
};

export type RawClaimedEvent = {
  user: string;
  amount: bigint;
  txHash: string;
  blockNumber: number;
  blockHash: string;
  logIndex: number;
};

/**
 * =====================================================
 * UNIFIED VESTING EVENT
 * =====================================================
 *
 * Both Allocated and Claimed events are normalized to
 * this common type for processing.
 */

export type VestingEventType = "ALLOCATED" | "CLAIMED";

export type VestingEvent = {
  type: VestingEventType;
  walletAddress: string;
  amountWei: string;
  txHash: string;
  blockNumber: number;
  blockHash: string;
  logIndex: number;
};

/**
 * =====================================================
 * SYNC RESULT
 * =====================================================
 */

export type VestingSyncResult = {
  fromBlock: number;
  toBlock: number;
  totalEvents: number;
  allocatedEvents: number;
  claimedEvents: number;
  errors: number;
  duration: number;
};

/**
 * =====================================================
 * PARTICIPANT TRACKING STATUS
 * =====================================================
 *
 * Derived from on-chain data. Not stored in DB as a field.
 */

export type ClaimStatus = "NOT_STARTED" | "PARTIAL" | "COMPLETED";

export type VestingParticipantProfile = {
  walletAddress: string;
  source: VestingSource;

  // ─── On-chain tracking (mirrors contract state) ──────────
  totalAllocatedWei: string;
  totalClaimedWei: string;
  remainingWei: string;

  // ─── Derived status ──────────────────────────────────────
  status: ClaimStatus;
  progress: number; // 0-100

  // ─── Claim history ───────────────────────────────────────
  lastClaimedAt: Date | null;
  claimCount: number;
  lastClaimTxHash: string | null;

  // ─── Classification (derived from relations) ─────────────
  classification: ParticipantClassification;
};

/**
 * =====================================================
 * USER CLASSIFICATION
 * =====================================================
 *
 * Derived from database relations, not stored as a field.
 * Determines the user's role in the ecosystem.
 */

export type ParticipantClassification =
  | "PARTICIPANT_ONLY"    // Has AirdropParticipant, no VestingSchedule
  | "BUYER_ONLY"          // Has VestingSchedule (from purchase), no AirdropParticipant
  | "BUYER_PARTICIPANT";  // Has both AirdropParticipant and VestingSchedule

/**
 * =====================================================
 * VESTING ANALYTICS (for admin dashboard)
 * =====================================================
 */

export type VestingAnalytics = {
  totalParticipants: number;
  totalAllocatedWei: string;
  totalClaimedWei: string;
  totalRemainingWei: string;

  // ─── By status ───────────────────────────────────────────
  notStarted: number;
  partial: number;
  completed: number;

  // ─── By source ───────────────────────────────────────────
  bySource: Array<{
    source: VestingSource;
    count: number;
    totalAllocatedWei: string;
    totalClaimedWei: string;
  }>;

  // ─── Classification breakdown ────────────────────────────
  classifications: {
    participantOnly: number;
    buyerOnly: number;
    buyerParticipant: number;
  };
};

/**
 * =====================================================
 * RECENT CLAIM (for admin dashboard)
 * =====================================================
 */

export type RecentClaim = {
  walletAddress: string;
  amountWei: string;
  txHash: string;
  blockNumber: bigint | null;
  blockTimestamp: Date | null;
  createdAt: Date;
};
