import { logger } from "@core/logger/logger";
import { env } from "@core/config/env";
import {
  getPastAllocations,
  getPastClaims,
  AllocatedEvent,
  ClaimedEvent,
} from "@core/blockchain/vesting.contract";
import {
  resolveBlockTimestamps,
  runEventSync,
  type BatchOutcome,
} from "@core/blockchain/sync-engine";
import {
  syncStateRepository,
  SYNC_KEYS,
} from "@modules/purchase/repositories/sync-state.repository";
import { vestingService } from "@modules/vesting/services/vesting.service";
import {
  VestingSyncResult,
  VestingEvent,
} from "@modules/vesting/types/vesting.types";

/**
 * =====================================================
 * VESTING SYNC LAYER (Indexer)
 * =====================================================
 *
 * Flow:
 *   Blockchain → Allocated/Claimed events → Mapping → Persistence → Checkpoint
 *
 * Shares the resumable engine with the Purchase sync, so it inherits:
 * resumable checkpoints, adaptive block ranges, exponential backoff and
 * "provider plan limit" clamping with an explicit history gap.
 *
 * IMPORTANT: a Claimed event with no VestingSchedule is not an error —
 * vestingService skips it (returns processed: false). That is counted as a
 * skip, not a failure, so it cannot block the checkpoint.
 */

const SYNC_CONFIG = {
  label: "Vesting sync",
  startBlockEnvName: "VESTING_START_BLOCK",
  stateKey: SYNC_KEYS.VESTING_LAST_BLOCK,
  gapKey: SYNC_KEYS.VESTING_SYNC_GAP,
} as const;

// ─── Event Fetching ────────────────────────────────────────────────────────

type VestingEventWithTimestamp = VestingEvent & {
  blockTimestamp: Date | null;
};

const fetchVestingRange = async (
  fromBlock: number,
  toBlock: number
): Promise<VestingEventWithTimestamp[]> => {
  // Fetch both event types in parallel, then merge deterministically.
  const [allocations, claims] = await Promise.all([
    getPastAllocations(fromBlock, toBlock),
    getPastClaims(fromBlock, toBlock),
  ]);

  const events: VestingEvent[] = [
    ...allocations.map(mapAllocatedEvent),
    ...claims.map(mapClaimedEvent),
  ].sort((a, b) =>
    a.blockNumber !== b.blockNumber
      ? a.blockNumber - b.blockNumber
      : a.logIndex - b.logIndex
  );

  if (events.length === 0) return [];

  const timestamps = await resolveBlockTimestamps(
    events.map((event) => event.blockNumber)
  );

  return events.map((event) => ({
    ...event,
    blockTimestamp: timestamps.get(event.blockNumber) ?? null,
  }));
};

// ─── Event Mapping ─────────────────────────────────────────────────────────

const mapAllocatedEvent = (event: AllocatedEvent): VestingEvent => ({
  type: "ALLOCATED",
  walletAddress: event.user.toLowerCase(),
  amountWei: event.amount.toString(),
  txHash: event.txHash,
  blockNumber: event.blockNumber,
  blockHash: event.blockHash,
  logIndex: event.logIndex,
});

const mapClaimedEvent = (event: ClaimedEvent): VestingEvent => ({
  type: "CLAIMED",
  walletAddress: event.user.toLowerCase(),
  amountWei: event.amount.toString(),
  txHash: event.txHash,
  blockNumber: event.blockNumber,
  blockHash: event.blockHash,
  logIndex: event.logIndex,
});

// ─── Event Processing ──────────────────────────────────────────────────────

type VestingCounters = {
  allocated: number;
  claimed: number;
};

const processVestingEvents = async (
  events: VestingEventWithTimestamp[],
  counters: VestingCounters
): Promise<BatchOutcome> => {
  let processed = 0;
  let skipped = 0;
  let errors = 0;
  const errorDetails: string[] = [];

  for (const event of events) {
    try {
      const result = await vestingService.processEvent({
        ...event,
        blockTimestamp: event.blockTimestamp ?? undefined,
      });

      if (result.processed) {
        processed++;

        if (event.type === "ALLOCATED") counters.allocated++;
        else counters.claimed++;
      } else {
        skipped++;
      }
    } catch (error: any) {
      errors++;
      errorDetails.push(`${event.txHash}: ${error?.message ?? "unknown error"}`);

      logger.error(
        {
          txHash: event.txHash,
          blockNumber: event.blockNumber,
          type: event.type,
          error: error?.message,
        },
        "Vesting sync: event processing failed"
      );
    }
  }

  return { processed, skipped, errors, errorDetails };
};

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Sync Vesting Allocated + Claimed events.
 * Safe to run repeatedly — persistence is idempotent by txHash.
 */
export const syncVestingEvents = async (): Promise<VestingSyncResult> => {
  const counters: VestingCounters = { allocated: 0, claimed: 0 };

  const outcome = await runEventSync({
    label: SYNC_CONFIG.label,
    startBlockEnvName: SYNC_CONFIG.startBlockEnvName,
    stateKey: SYNC_CONFIG.stateKey,
    gapKey: SYNC_CONFIG.gapKey,
    configuredStartBlock: env.sync.vestingStartBlock,
    batchSize: env.sync.batchSize,
    safeLookbackBlocks: env.sync.safeLookbackBlocks,
    maxRetries: env.sync.maxRetries,
    retryBaseDelayMs: env.sync.retryBaseDelayMs,
    batchDelayMs: env.sync.batchDelayMs,
    fetchRange: fetchVestingRange,
    processEvents: (events) => processVestingEvents(events, counters),
    store: syncStateRepository,
  });

  return {
    fromBlock: outcome.fromBlock,
    toBlock: outcome.toBlock,
    totalEvents: outcome.totalEvents,
    allocatedEvents: counters.allocated,
    claimedEvents: counters.claimed,
    errors: outcome.errors,
    duration: outcome.duration,
    batches: outcome.batches,
    gap: outcome.gap,
    skippedRun: outcome.skippedRun,
  };
};
