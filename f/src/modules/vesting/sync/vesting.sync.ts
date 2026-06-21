import { logger } from "@core/logger/logger";
import { provider } from "@core/blockchain/provider";
import {
  getPastAllocations,
  getPastClaims,
  getLatestBlockNumber,
  AllocatedEvent,
  ClaimedEvent,
} from "@core/blockchain/vesting.contract";
import { syncStateRepository, SYNC_KEYS } from "@modules/purchase/repositories/sync-state.repository";
import { vestingService } from "@modules/vesting/services/vesting.service";
import { VestingSyncError } from "@modules/vesting/errors/vesting-sync.error";
import { VestingSyncResult, VestingEvent } from "@modules/vesting/types/vesting.types";
import { retry } from "@core/blockchain/retry.service";

/**
 * =====================================================
 * VESTING SYNC LAYER (Indexer)
 * =====================================================
 *
 * Implements the Indexer Pattern:
 *   Blockchain → Events → Mapping → Persistence → Checkpoint
 *
 * - Reads Allocated and Claimed events from Vesting contract
 * - Maps raw events to unified VestingEvent type
 * - Persists via service (idempotent via txHash)
 * - Tracks checkpoint in SyncState
 *
 * Designed for fault tolerance:
 *   1. Resumable from last checkpoint
 *   2. RPC failure recovery via retry
 *   3. Idempotent processing (txHash uniqueness)
 *   4. Batch processing for large ranges
 */

// ─── Configuration ──────────────────────────────────────────────────────────

const SYNC_CONFIG = {
  /** Max blocks per RPC query batch */
  BATCH_SIZE: 5_000,
  /** Max retry attempts for RPC calls */
  MAX_RETRIES: 3,
  /** Delay between retries (ms) */
  RETRY_DELAY_MS: 2_000,
} as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// ─── Core Sync ──────────────────────────────────────────────────────────────

/**
 * Sync vesting events from blockchain.
 *
 * Flow:
 *   1. Read last processed block from SyncState
 *   2. Get current chain block
 *   3. Query Allocated + Claimed events in batches
 *   4. Process each event (idempotent)
 *   5. Update checkpoint after each batch
 *
 * Safe to run multiple times — idempotent by design.
 */
export const syncVestingEvents = async (): Promise<VestingSyncResult> => {
  const startTime = Date.now();
  let totalEvents = 0;
  let allocatedEvents = 0;
  let claimedEvents = 0;
  let errors = 0;

  // ─── Step 1: Get checkpoint ──────────────────────────────────
  const lastProcessedBlock = await syncStateRepository.getLastBlock(
    SYNC_KEYS.VESTING_LAST_BLOCK
  );

  const currentBlock = await retry(
    () => getLatestBlockNumber(),
    SYNC_CONFIG.MAX_RETRIES,
    SYNC_CONFIG.RETRY_DELAY_MS
  );

  if (lastProcessedBlock >= currentBlock) {
    logger.info(
      { lastProcessedBlock, currentBlock },
      "Vesting sync: no new blocks to process"
    );
    return {
      fromBlock: lastProcessedBlock,
      toBlock: currentBlock,
      totalEvents: 0,
      allocatedEvents: 0,
      claimedEvents: 0,
      errors: 0,
      duration: Date.now() - startTime,
    };
  }

  const fromBlock = lastProcessedBlock + 1;
  const toBlock = currentBlock;

  logger.info(
    { fromBlock, toBlock, diff: toBlock - fromBlock },
    "Vesting sync: starting"
  );

  // ─── Step 2: Process in batches ──────────────────────────────
  let batchFrom = fromBlock;

  while (batchFrom <= toBlock) {
    const batchTo = Math.min(
      batchFrom + SYNC_CONFIG.BATCH_SIZE - 1,
      toBlock
    );

    try {
      const result = await syncBatch(batchFrom, batchTo);
      totalEvents += result.events;
      allocatedEvents += result.allocatedEvents;
      claimedEvents += result.claimedEvents;
      errors += result.errors;

      // ─── Update checkpoint ────────────────────────────────────
      await syncStateRepository.setLastBlock(
        SYNC_KEYS.VESTING_LAST_BLOCK,
        batchTo
      );

      logger.info(
        {
          batchFrom,
          batchTo,
          events: result.events,
          allocatedEvents: result.allocatedEvents,
          claimedEvents: result.claimedEvents,
          errors: result.errors,
        },
        "Vesting sync: batch completed"
      );
    } catch (error: any) {
      logger.error(
        {
          batchFrom,
          batchTo,
          error: error.message,
        },
        "Vesting sync: batch failed"
      );

      // If batch fails, stop and retry on next run
      // The checkpoint is still at the last successful batch
      throw new VestingSyncError(
        `Batch ${batchFrom}-${batchTo} failed: ${error.message}`
      );
    }

    batchFrom = batchTo + 1;

    // Small delay between batches to avoid RPC rate limiting
    if (batchFrom <= toBlock) {
      await sleep(100);
    }
  }

  const duration = Date.now() - startTime;

  logger.info(
    {
      fromBlock,
      toBlock,
      totalEvents,
      allocatedEvents,
      claimedEvents,
      errors,
      duration,
    },
    "Vesting sync: completed"
  );

  return {
    fromBlock,
    toBlock,
    totalEvents,
    allocatedEvents,
    claimedEvents,
    errors,
    duration,
  };
};

// ─── Batch Processing ───────────────────────────────────────────────────────

type BatchResult = {
  events: number;
  allocatedEvents: number;
  claimedEvents: number;
  errors: number;
};

const syncBatch = async (
  fromBlock: number,
  toBlock: number
): Promise<BatchResult> => {
  let allocatedEvents = 0;
  let claimedEvents = 0;
  let errors = 0;

  // Fetch both event types in parallel
  const [allocations, claims] = await Promise.all([
    retry(
      () => getPastAllocations(fromBlock, toBlock),
      SYNC_CONFIG.MAX_RETRIES,
      SYNC_CONFIG.RETRY_DELAY_MS
    ),
    retry(
      () => getPastClaims(fromBlock, toBlock),
      SYNC_CONFIG.MAX_RETRIES,
      SYNC_CONFIG.RETRY_DELAY_MS
    ),
  ]);

  // Merge and sort by block number, then log index for deterministic ordering
  const allEvents: VestingEvent[] = [
    ...allocations.map((e) => mapAllocatedEvent(e)),
    ...claims.map((e) => mapClaimedEvent(e)),
  ].sort((a, b) =>
    a.blockNumber !== b.blockNumber
      ? a.blockNumber - b.blockNumber
      : a.logIndex - b.logIndex
  );

  // Enrich events with block timestamps
  const enrichedEvents = await enrichEventsWithTimestamps(allEvents);

  for (const event of enrichedEvents) {
    try {
      await vestingService.processEvent(event);

      if (event.type === "ALLOCATED") {
        allocatedEvents++;
      } else {
        claimedEvents++;
      }
    } catch (error: any) {
      errors++;
      logger.error(
        {
          txHash: event.txHash,
          blockNumber: event.blockNumber,
          type: event.type,
          error: error.message,
        },
        "Vesting sync: event processing failed"
      );
      // Continue with next event — don't break the batch
    }
  }

  return {
    events: enrichedEvents.length,
    allocatedEvents,
    claimedEvents,
    errors,
  };
};

// ─── Event Mapping ──────────────────────────────────────────────────────────

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

// ─── Block Timestamp Enrichment ─────────────────────────────────────────────

type EnrichedVestingEvent = VestingEvent & { blockTimestamp: Date };

/**
 * Enrich events with block timestamps.
 * Groups by block number to minimize RPC calls (shared timestamp).
 */
const enrichEventsWithTimestamps = async (
  events: VestingEvent[]
): Promise<EnrichedVestingEvent[]> => {
  if (events.length === 0) return [];

  // Group by block number
  const blockNumbers = [...new Set(events.map((e) => e.blockNumber))];

  // Fetch block timestamps (with retry)
  const timestampMap = new Map<number, Date>();

  for (const blockNum of blockNumbers) {
    try {
      const block = await retry(
        () => provider.getBlock(blockNum),
        SYNC_CONFIG.MAX_RETRIES,
        SYNC_CONFIG.RETRY_DELAY_MS
      );

      if (block) {
        timestampMap.set(blockNum, new Date(block.timestamp * 1000));
      }
    } catch (error: any) {
      logger.warn(
        { blockNumber: blockNum, error: error.message },
        "Vesting sync: failed to fetch block timestamp, using epoch"
      );
      timestampMap.set(blockNum, new Date(0));
    }
  }

  // Enrich events
  return events.map((event) => ({
    ...event,
    blockTimestamp:
      timestampMap.get(event.blockNumber) || new Date(0),
  }));
};
