import { logger } from "@core/logger/logger";
import { env } from "@core/config/env";
import { provider } from "@core/blockchain/provider";
import {
  getPastPurchases,
  getLatestBlockNumber,
  PurchasedEvent,
} from "@core/blockchain/sale.contract";
import { syncStateRepository, SYNC_KEYS } from "@modules/purchase/repositories/sync-state.repository";
import { purchaseService } from "@modules/purchase/services/purchase.service";
import { mapEventToPurchase } from "@modules/purchase/domain/purchase.domain";
import { PurchaseSyncError } from "@modules/purchase/errors/purchase-sync.error";
import { SyncResult } from "@modules/purchase/types/purchase.types";
import { retry } from "@core/blockchain/retry.service";

/**
 * =====================================================
 * PURCHASE SYNC LAYER (Indexer)
 * =====================================================
 *
 * Implements the Indexer Pattern:
 *   Blockchain → Events → Mapping → Persistence → Checkpoint
 *
 * - Reads Purchased events from Sale contract
 * - Maps raw events to purchase data
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
  /** Chain ID from env */
  CHAIN_ID: env.chainId,
} as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// ─── Core Sync ──────────────────────────────────────────────────────────────

/**
 * Sync purchase events from blockchain.
 *
 * Flow:
 *   1. Read last processed block from SyncState
 *   2. Get current chain block
 *   3. Query events in batches
 *   4. Process each event (idempotent)
 *   5. Update checkpoint after each batch
 *
 * Safe to run multiple times — idempotent by design.
 */
export const syncPurchaseEvents = async (): Promise<SyncResult> => {
  const startTime = Date.now();
  let totalEvents = 0;
  let newPurchases = 0;
  let duplicatePurchases = 0;
  let errors = 0;

  // ─── Step 1: Get checkpoint ──────────────────────────────────
  const lastProcessedBlock = await syncStateRepository.getLastBlock(
    SYNC_KEYS.SALE_LAST_BLOCK
  );

  const currentBlock = await retry(
    () => getLatestBlockNumber(),
    SYNC_CONFIG.MAX_RETRIES,
    SYNC_CONFIG.RETRY_DELAY_MS
  );

  if (lastProcessedBlock >= currentBlock) {
    logger.info(
      { lastProcessedBlock, currentBlock },
      "Purchase sync: no new blocks to process"
    );
    return {
      fromBlock: lastProcessedBlock,
      toBlock: currentBlock,
      totalEvents: 0,
      newPurchases: 0,
      duplicatePurchases: 0,
      errors: 0,
      duration: Date.now() - startTime,
    };
  }

  const fromBlock = lastProcessedBlock + 1;
  const toBlock = currentBlock;

  logger.info(
    { fromBlock, toBlock, diff: toBlock - fromBlock },
    "Purchase sync: starting"
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
      newPurchases += result.newPurchases;
      duplicatePurchases += result.duplicates;
      errors += result.errors;

      // ─── Update checkpoint ────────────────────────────────────
      await syncStateRepository.setLastBlock(
        SYNC_KEYS.SALE_LAST_BLOCK,
        batchTo
      );

      logger.info(
        {
          batchFrom,
          batchTo,
          events: result.events,
          newPurchases: result.newPurchases,
          duplicates: result.duplicates,
          errors: result.errors,
        },
        "Purchase sync: batch completed"
      );
    } catch (error: any) {
      logger.error(
        {
          batchFrom,
          batchTo,
          error: error.message,
        },
        "Purchase sync: batch failed"
      );

      // If batch fails, stop and retry on next run
      // The checkpoint is still at the last successful batch
      throw new PurchaseSyncError(
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
      newPurchases,
      duplicatePurchases,
      errors,
      duration,
    },
    "Purchase sync: completed"
  );

  return {
    fromBlock,
    toBlock,
    totalEvents,
    newPurchases,
    duplicatePurchases,
    errors,
    duration,
  };
};

// ─── Batch Processing ───────────────────────────────────────────────────────

type BatchResult = {
  events: number;
  newPurchases: number;
  duplicates: number;
  errors: number;
};

const syncBatch = async (
  fromBlock: number,
  toBlock: number
): Promise<BatchResult> => {
  let newPurchases = 0;
  let duplicates = 0;
  let errors = 0;

  // Fetch events with retry
  const events = await retry(
    () => getPastPurchases(fromBlock, toBlock),
    SYNC_CONFIG.MAX_RETRIES,
    SYNC_CONFIG.RETRY_DELAY_MS
  );

  // Enrich events with block timestamps
  const enrichedEvents = await enrichEventsWithTimestamps(events);

  for (const event of enrichedEvents) {
    try {
      // Map raw event to purchase data
      const mapped = await mapEventToPurchase(
        event,
        SYNC_CONFIG.CHAIN_ID
      );

      // Update block timestamp from enrichment
      mapped.blockTimestamp = event.blockTimestamp;

      // Process via service (idempotent)
      const result = await purchaseService.processEvent(mapped);

      if (result.created) {
        newPurchases++;
      } else {
        duplicates++;
      }
    } catch (error: any) {
      errors++;
      logger.error(
        {
          txHash: event.txHash,
          blockNumber: event.blockNumber,
          error: error.message,
        },
        "Purchase sync: event processing failed"
      );
      // Continue with next event — don't break the batch
    }
  }

  return {
    events: enrichedEvents.length,
    newPurchases,
    duplicates,
    errors,
  };
};

// ─── Block Timestamp Enrichment ─────────────────────────────────────────────

type EnrichedEvent = PurchasedEvent & { blockTimestamp: Date };

/**
 * Enrich events with block timestamps.
 * Groups by block number to minimize RPC calls (shared timestamp).
 */
const enrichEventsWithTimestamps = async (
  events: PurchasedEvent[]
): Promise<EnrichedEvent[]> => {
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
        "Failed to fetch block timestamp, using epoch"
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
