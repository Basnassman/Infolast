import { logger } from "@core/logger/logger";
import { env } from "@core/config/env";
import {
  getPastPurchases,
  PurchasedEvent,
} from "@core/blockchain/sale.contract";
import {
  resolveBlockTimestamps,
  runEventSync,
  type BatchOutcome,
} from "@core/blockchain/sync-engine";
import {
  syncStateRepository,
  SYNC_KEYS,
} from "@modules/purchase/repositories/sync-state.repository";
import { purchaseService } from "@modules/purchase/services/purchase.service";
import { mapEventToPurchase } from "@modules/purchase/domain/purchase.domain";
import { SyncResult } from "@modules/purchase/types/purchase.types";

/**
 * =====================================================
 * PURCHASE SYNC LAYER (Indexer)
 * =====================================================
 *
 * Flow:
 *   Blockchain → Purchased events → Mapping → Persistence → Checkpoint
 *
 * Behaviour:
 *  - Starts from SALE_START_BLOCK (deployment block) or resumes from the
 *    last checkpoint stored in SyncState. It never restarts at block 1
 *    once a checkpoint exists.
 *  - One batch per eth_getLogs request; the shared engine halves the range
 *    when the provider rejects it as too large.
 *  - Provider plan limits ("Archive, Debug and Trace ... not available")
 *    are handled by clamping to the provider's queryable window and
 *    recording the skipped range instead of retrying forever.
 *  - The checkpoint only advances after every event in the batch is
 *    persisted, so a failure can never drop events.
 */

const SYNC_CONFIG = {
  label: "Purchase sync",
  startBlockEnvName: "SALE_START_BLOCK",
  stateKey: SYNC_KEYS.SALE_LAST_BLOCK,
  gapKey: SYNC_KEYS.SALE_SYNC_GAP,
} as const;

// ─── Event Fetching ────────────────────────────────────────────────────────

type PurchasedEventWithTimestamp = PurchasedEvent & {
  blockTimestamp: Date | null;
};

const fetchPurchaseRange = async (
  fromBlock: number,
  toBlock: number
): Promise<PurchasedEventWithTimestamp[]> => {
  const events = await getPastPurchases(fromBlock, toBlock);

  if (events.length === 0) return [];

  const timestamps = await resolveBlockTimestamps(
    events.map((event) => event.blockNumber)
  );

  return events.map((event) => ({
    ...event,
    blockTimestamp: timestamps.get(event.blockNumber) ?? null,
  }));
};

// ─── Event Processing ──────────────────────────────────────────────────────

const processPurchaseEvents = async (
  events: PurchasedEventWithTimestamp[]
): Promise<BatchOutcome> => {
  let processed = 0;
  let skipped = 0;
  let errors = 0;
  const errorDetails: string[] = [];

  for (const event of events) {
    try {
      const mapped = await mapEventToPurchase(event, env.chainId);

      // Timestamp is best-effort: unavailable blocks fall back to epoch
      // (the database column is informational, not used for decisions).
      mapped.blockTimestamp = event.blockTimestamp ?? new Date(0);

      const result = await purchaseService.processEvent(mapped);

      if (result.created) {
        processed++;
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
          currency: event.currency,
          error: error?.message,
        },
        "Purchase sync: event processing failed"
      );
    }
  }

  return { processed, skipped, errors, errorDetails };
};

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Sync Purchase events from the Sale contract.
 * Safe to run concurrently/repeatedly — persistence is idempotent by txHash.
 */
export const syncPurchaseEvents = async (): Promise<SyncResult> => {
  const outcome = await runEventSync({
    label: SYNC_CONFIG.label,
    startBlockEnvName: SYNC_CONFIG.startBlockEnvName,
    stateKey: SYNC_CONFIG.stateKey,
    gapKey: SYNC_CONFIG.gapKey,
    configuredStartBlock: env.sync.saleStartBlock,
    batchSize: env.sync.batchSize,
    safeLookbackBlocks: env.sync.safeLookbackBlocks,
    maxRetries: env.sync.maxRetries,
    retryBaseDelayMs: env.sync.retryBaseDelayMs,
    batchDelayMs: env.sync.batchDelayMs,
    fetchRange: fetchPurchaseRange,
    processEvents: processPurchaseEvents,
    store: syncStateRepository,
  });

  return {
    fromBlock: outcome.fromBlock,
    toBlock: outcome.toBlock,
    totalEvents: outcome.totalEvents,
    newPurchases: outcome.processed,
    duplicatePurchases: outcome.skipped,
    errors: outcome.errors,
    duration: outcome.duration,
    batches: outcome.batches,
    gap: outcome.gap,
    skippedRun: outcome.skippedRun,
  };
};
