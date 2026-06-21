import { VestingSource } from "@prisma/client";
import { vestingRepository } from "@modules/vesting/repositories/vesting.repository";
import { userRepository } from "@modules/user/repositories/user.repository";
import {
  classifyParticipant,
  buildParticipantProfile,
  computeAnalytics,
} from "@modules/vesting/domain/vesting.domain";
import {
  VestingEvent,
  VestingParticipantProfile,
  VestingAnalytics,
  RecentClaim,
} from "@modules/vesting/types/vesting.types";
import { logger } from "@core/logger/logger";

/**
 * =====================================================
 * VESTING SERVICE
 * =====================================================
 *
 * Responsible ONLY for:
 * - Business logic
 * - Validation
 * - Processing events
 * - Building profiles from tracking data
 *
 * NOT responsible for:
 * - Prisma queries (→ repository)
 * - Blockchain reading (→ sync layer)
 *
 * The blockchain is the Source of Truth.
 * This service processes events into the tracking layer.
 */

export const vestingService = {
  /**
   * Process a single vesting event from the indexer.
   *
   * - ALLOCATED: Creates or updates the VestingSchedule for this user.
   * - CLAIMED: Records a claim event and updates aggregate stats.
   *
   * Idempotent — processing the same event twice is safe.
   */
  async processEvent(event: VestingEvent & { blockTimestamp?: Date }): Promise<{
    processed: boolean;
    scheduleId?: string;
  }> {
    // Find or create user
    const user = await userRepository.findOrCreate(event.walletAddress);

    if (event.type === "ALLOCATED") {
      return this.processAllocation(user.id, event);
    }

    return this.processClaim(user.id, event);
  },

  /**
   * Process an Allocated event.
   * Creates or updates the vesting schedule.
   */
  async processAllocation(
    userId: string,
    event: VestingEvent & { blockTimestamp?: Date }
  ): Promise<{ processed: boolean; scheduleId: string }> {
    const schedule = await vestingRepository.upsertSchedule({
      walletAddress: event.walletAddress,
      source: VestingSource.PRESALE, // Default; can be refined with config
      totalAllocatedWei: event.amountWei,
    });

    logger.info(
      {
        scheduleId: schedule.id,
        walletAddress: event.walletAddress,
        amountWei: event.amountWei,
        txHash: event.txHash,
      },
      "Vesting allocation recorded"
    );

    return { processed: true, scheduleId: schedule.id };
  },

  /**
   * Process a Claimed event.
   * Records the claim and updates aggregate stats.
   *
   * Idempotent — duplicate txHash is skipped.
   */
  async processClaim(
    userId: string,
    event: VestingEvent & { blockTimestamp?: Date }
  ): Promise<{ processed: boolean; scheduleId?: string }> {
    // Find the schedule for this user
    const schedule = await vestingRepository.findByWallet(
      event.walletAddress
    );

    if (!schedule) {
      logger.warn(
        {
          walletAddress: event.walletAddress,
          txHash: event.txHash,
        },
        "Claim event for unknown schedule — skipping"
      );
      return { processed: false };
    }

    // Record the claim event (idempotent)
    await vestingRepository.recordClaimEvent({
      scheduleId: schedule.id,
      amountWei: event.amountWei,
      txHash: event.txHash,
      blockNumber: BigInt(event.blockNumber),
      blockTimestamp: event.blockTimestamp ?? new Date(),
    });

    // Always update aggregate stats — idempotent operation
    await vestingRepository.updateScheduleClaimStats(schedule.id);

    logger.info(
      {
        scheduleId: schedule.id,
        walletAddress: event.walletAddress,
        amountWei: event.amountWei,
        txHash: event.txHash,
      },
      "Vesting claim processed"
    );

    return { processed: true, scheduleId: schedule.id };
  },

  /**
   * Get vesting participant profile.
   * Combines database tracking data with classification.
   */
  async getParticipantProfile(
    walletAddress: string
  ): Promise<VestingParticipantProfile | null> {
    const normalizedWallet = walletAddress.toLowerCase();

    const user = await userRepository.findByWallet(normalizedWallet);
    if (!user) return null;

    const schedule = await vestingRepository.findByWallet(normalizedWallet);
    if (!schedule) return null;

    // Derive classification from relations
    // userRepository.findByWallet includes airdropParticipant via Prisma include
    const hasAirdrop = !!(user as any).airdropParticipant;
    const classification = classifyParticipant(hasAirdrop, true);

    return buildParticipantProfile(schedule, classification);
  },

  /**
   * Get vesting analytics for admin dashboard.
   */
  async getAnalytics(): Promise<VestingAnalytics> {
    const [totals, neverClaimed, fullyClaimed, bySource, classifications] = await Promise.all([
      vestingRepository.getAggregatedTotals(),
      vestingRepository.findNeverClaimed(),
      vestingRepository.findFullyClaimed(),
      vestingRepository.getStatsBySource(),
      vestingRepository.getClassificationCounts(),
    ]);

    return computeAnalytics({
      totals,
      neverClaimed: neverClaimed.length,
      fullyClaimed: fullyClaimed.length,
      bySource: bySource.map((s) => ({
        source: s.source,
        count: Number(s.count),
        totalAllocatedWei: s.totalAllocatedWei ?? "0",
        totalClaimedWei: s.totalClaimedWei ?? "0",
      })),
      classifications: {
        participantOnly: classifications.participantOnly,
        buyerOnly: classifications.buyerOnly,
        buyerParticipant: classifications.buyerParticipant,
      },
    });
  },

  /**
   * Get recent claim events (admin dashboard).
   */
  async getRecentClaims(limit: number): Promise<RecentClaim[]> {
    const events = await vestingRepository.findRecentClaims(limit);

    return events.map((event) => ({
      walletAddress: event.vestingSchedule.userId,
      amountWei: event.amountWei,
      txHash: event.txHash,
      blockNumber: event.blockNumber,
      blockTimestamp: event.blockTimestamp,
      createdAt: event.createdAt,
    }));
  },

  /**
   * Record a vesting claim reported by the frontend.
   *
   * This is a fallback for when the sync indexer hasn't processed
   * the Claimed event yet. The indexer is the primary source —
   * this method is called by the frontend after a successful claim.
   */
  async recordFrontendClaim(
    walletAddress: string,
    txHash: string,
    amountWei: string
  ): Promise<{ created: boolean; scheduleId?: string }> {
    const normalizedWallet = walletAddress.toLowerCase();

    // Idempotency check
    const existing = await vestingRepository.findClaimByTxHash(txHash);
    if (existing) {
      logger.debug({ txHash }, "Frontend claim: already recorded, skipping");
      return { created: false };
    }

    // Create or find user
    await userRepository.findOrCreate(normalizedWallet);

    // Find schedule
    const schedule = await vestingRepository.findByWallet(normalizedWallet);

    if (!schedule) {
      // Schedule doesn't exist yet — sync hasn't run or allocation hasn't happened
      // Create a minimal schedule so we can record the claim
      const newSchedule = await vestingRepository.upsertSchedule({
        walletAddress: normalizedWallet,
        source: VestingSource.PRESALE,
        totalAllocatedWei: "0", // Will be updated by sync
      });

      // Record the claim event
      await vestingRepository.recordClaimEvent({
        scheduleId: newSchedule.id,
        amountWei,
        txHash,
        blockNumber: BigInt(0), // Will be enriched by sync
        blockTimestamp: new Date(),
      });

      await vestingRepository.updateScheduleClaimStats(newSchedule.id);

      return { created: true, scheduleId: newSchedule.id };
    }

    // Record claim event
    await vestingRepository.recordClaimEvent({
      scheduleId: schedule.id,
      amountWei,
      txHash,
      blockNumber: BigInt(0),
      blockTimestamp: new Date(),
    });

    await vestingRepository.updateScheduleClaimStats(schedule.id);

    return { created: true, scheduleId: schedule.id };
  },
};
