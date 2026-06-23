import { prisma } from "@core/db/prisma";
import { VestingSource, Prisma } from "@prisma/client";

/**
 * =====================================================
 * VESTING REPOSITORY
 * =====================================================
 *
 * Responsible ONLY for Prisma queries and persistence.
 * No business logic here.
 *
 * The database is a Tracking & Analytics Layer only.
 * Blockchain is the Source of Truth.
 */

export const vestingRepository = {
  // ─── Schedule CRUD ────────────────────────────────────────

  /**
   * Find vesting schedule by user wallet address.
   * Resolves wallet address → User.id before querying.
   * Returns the schedule with user relation for wallet access.
   */
  async findByWallet(walletAddress: string) {
    const normalizedWallet = walletAddress.toLowerCase();
    return prisma.vestingSchedule.findFirst({
      where: {
        user: { walletAddress: normalizedWallet },
      },
      include: {
        claimEvents: {
          orderBy: { blockTimestamp: "desc" },
        },
        user: {
          select: { walletAddress: true },
        },
      },
    });
  },

  /**
   * Find vesting schedule by User.id (cuid).
   */
  async findByUserId(userId: string) {
    return prisma.vestingSchedule.findFirst({
      where: { userId },
      include: {
        claimEvents: {
          orderBy: { blockTimestamp: "desc" },
        },
        user: {
          select: { walletAddress: true },
        },
      },
    });
  },

  /**
   * Find vesting schedule by ID.
   */
  async findById(id: string) {
    return prisma.vestingSchedule.findUnique({
      where: { id },
      include: {
        claimEvents: {
          orderBy: { blockTimestamp: "desc" },
        },
      },
    });
  },

  /**
   * Create a new vesting schedule (from Allocated event).
   * Uses upsert for idempotency — if schedule already exists,
   * update the total allocated amount.
   *
   * @param userId - The User.id (cuid), NOT the wallet address.
   */
  async upsertSchedule(data: {
    userId: string;
    source: VestingSource;
    totalAllocatedWei: string;
  }) {
    // Check if schedule exists for this user
    const existing = await prisma.vestingSchedule.findFirst({
      where: { userId: data.userId },
    });

    if (existing) {
      // Update total allocated (in case of re-allocation)
      return prisma.vestingSchedule.update({
        where: { id: existing.id },
        data: {
          totalAllocatedWei: data.totalAllocatedWei,
        },
      });
    }

    // Create new schedule
    return prisma.vestingSchedule.create({
      data: {
        userId: data.userId,
        source: data.source,
        totalAllocatedWei: data.totalAllocatedWei,
      },
    });
  },

  // ─── Claim Events ─────────────────────────────────────────

  /**
   * Record a claim event (from Claimed blockchain event).
   * Returns the created record, or null if already exists (idempotent).
   */
  async recordClaimEvent(data: {
    scheduleId: string;
    amountWei: string;
    txHash: string;
    blockNumber: bigint;
    blockTimestamp: Date;
  }) {
    const normalizedTxHash = data.txHash.toLowerCase();

    // Check for duplicate (idempotency)
    const existing = await prisma.vestingClaimEvent.findUnique({
      where: { txHash: normalizedTxHash },
    });

    if (existing) {
      return existing; // Already processed
    }

    return prisma.vestingClaimEvent.create({
      data: {
        vestingScheduleId: data.scheduleId,
        amountWei: data.amountWei,
        txHash: normalizedTxHash,
        blockNumber: data.blockNumber,
        blockTimestamp: data.blockTimestamp,
      },
    });
  },

  /**
   * Update schedule's aggregate claim stats.
   * Called after recording a claim event.
   */
  async updateScheduleClaimStats(scheduleId: string) {
    // Use raw query since Prisma aggregate doesn't support String field sums
    const result = await prisma.$queryRaw<
      Array<{ totalClaimed: string | null; claimCount: bigint }>
    >`
      SELECT
        SUM("amountWei"::numeric) as "totalClaimed",
        COUNT(*) as "claimCount"
      FROM "VestingClaimEvent"
      WHERE "vestingScheduleId" = ${scheduleId}
    `;

    // Get the latest claim event
    const latestClaim = await prisma.vestingClaimEvent.findFirst({
      where: { vestingScheduleId: scheduleId },
      orderBy: { blockTimestamp: "desc" },
    });

    const totalClaimed = result[0]?.totalClaimed ?? "0";
    const claimCount = Number(result[0]?.claimCount ?? 0);

    return prisma.vestingSchedule.update({
      where: { id: scheduleId },
      data: {
        totalClaimedWei: totalClaimed.toString(),
        claimCount,
        lastClaimedAt: latestClaim?.blockTimestamp ?? null,
        lastClaimTxHash: latestClaim?.txHash ?? null,
      },
    });
  },

  /**
   * Find an existing claim by txHash (idempotency check).
   */
  async findClaimByTxHash(txHash: string) {
    return prisma.vestingClaimEvent.findUnique({
      where: { txHash: txHash.toLowerCase() },
    });
  },

  // ─── Queries ──────────────────────────────────────────────

  /**
   * Get all vesting schedules with claim summaries.
   */
  async findAllSchedules() {
    return prisma.vestingSchedule.findMany({
      include: {
        claimEvents: {
          orderBy: { blockTimestamp: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  /**
   * Get vesting schedules grouped by source.
   */
  async getStatsBySource() {
    return prisma.$queryRaw<
      Array<{
        source: string;
        count: bigint;
        totalAllocatedWei: string | null;
        totalClaimedWei: string | null;
      }>
    >`
      SELECT
        source,
        COUNT(*) as count,
        SUM("totalAllocatedWei"::numeric) as "totalAllocatedWei",
        SUM("totalClaimedWei"::numeric) as "totalClaimedWei"
      FROM "VestingSchedule"
      GROUP BY source
    `;
  },

  /**
   * Count total vesting participants.
   */
  async countParticipants(): Promise<number> {
    return prisma.vestingSchedule.count();
  },

  /**
   * Get recent claim events across all participants.
   */
  async findRecentClaims(limit: number) {
    return prisma.vestingClaimEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        vestingSchedule: {
          select: { userId: true },
          include: {
            user: {
              select: { walletAddress: true },
            },
          },
        },
      },
    });
  },

  /**
   * Check if a txHash exists (lightweight idempotency check).
   */
  async existsByTxHash(txHash: string): Promise<boolean> {
    const count = await prisma.vestingClaimEvent.count({
      where: { txHash: txHash.toLowerCase() },
    });
    return count > 0;
  },

  // ─── Analytics Queries ────────────────────────────────────

  /**
   * Get participants who never claimed.
   */
  async findNeverClaimed() {
    return prisma.vestingSchedule.findMany({
      where: { claimCount: 0 },
      select: {
        userId: true,
        source: true,
        totalAllocatedWei: true,
      },
    });
  },

  /**
   * Get participants who partially claimed.
   */
  async findPartiallyClaimed() {
    return prisma.vestingSchedule.findMany({
      where: {
        claimCount: { gt: 0 },
        totalClaimedWei: { not: "0" },
      },
      select: {
        userId: true,
        source: true,
        totalAllocatedWei: true,
        totalClaimedWei: true,
        claimCount: true,
      },
    });
  },

  /**
   * Get participants who fully claimed (claimed == allocated).
   */
  async findFullyClaimed() {
    // Use raw query since Prisma can't compare string fields directly
    return prisma.$queryRaw<
      Array<{
        id: string;
        userId: string;
        source: string;
        totalAllocatedWei: string;
        totalClaimedWei: string;
      }>
    >`
      SELECT id, "userId", source, "totalAllocatedWei", "totalClaimedWei"
      FROM "VestingSchedule"
      WHERE "totalClaimedWei"::numeric >= "totalAllocatedWei"::numeric
        AND "totalAllocatedWei"::numeric > 0
    `;
  },

  /**
   * Get user classification counts in a single batch query.
   * Returns how many vesting participants also have airdrop participation.
   */
  async getClassificationCounts() {
    const result = await prisma.$queryRaw<
      Array<{ hasAirdrop: boolean; count: bigint }>
    >`
      SELECT
        CASE WHEN ap."userId" IS NOT NULL THEN true ELSE false END as "hasAirdrop",
        COUNT(*) as count
      FROM "VestingSchedule" vs
      LEFT JOIN "AirdropParticipant" ap ON ap."userId" = vs."userId"
      GROUP BY (ap."userId" IS NOT NULL)
    `;

    let buyerOnly = 0;
    let buyerParticipant = 0;

    for (const row of result) {
      if (row.hasAirdrop) {
        buyerParticipant = Number(row.count);
      } else {
        buyerOnly = Number(row.count);
      }
    }

    // participantOnly: airdrop participants without vesting schedules
    const participantOnlyResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM "AirdropParticipant" ap
      WHERE NOT EXISTS (
        SELECT 1 FROM "VestingSchedule" vs WHERE vs."userId" = ap."userId"
      )
    `;

    return {
      participantOnly: Number(participantOnlyResult[0]?.count ?? 0),
      buyerOnly,
      buyerParticipant,
    };
  },

  /**
   * Get aggregated vesting totals.
   */
  async getAggregatedTotals() {
    const result = await prisma.$queryRaw<
      Array<{
        totalParticipants: bigint;
        totalAllocatedWei: string | null;
        totalClaimedWei: string | null;
      }>
    >`
      SELECT
        COUNT(*) as "totalParticipants",
        SUM("totalAllocatedWei"::numeric) as "totalAllocatedWei",
        SUM("totalClaimedWei"::numeric) as "totalClaimedWei"
      FROM "VestingSchedule"
    `;

    return {
      totalParticipants: Number(result[0]?.totalParticipants ?? 0),
      totalAllocatedWei: result[0]?.totalAllocatedWei?.toString() ?? "0",
      totalClaimedWei: result[0]?.totalClaimedWei?.toString() ?? "0",
    };
  },
};
