import { logger } from "@core/logger/logger";
import { provider } from "@core/blockchain/provider";
import { assertSepoliaNetwork } from "@core/blockchain/chain-guard";
import { classifyRpcError, isRetryableRpcError } from "./rpc-errors";
import { retry } from "./retry.service";
import {
  clampRangeToFloor,
  mergeGap,
  queryableFloor,
  resolveStartBlock,
  splitRange,
  GAP_REASON_PROVIDER_WINDOW,
  type SyncGap,
} from "./sync-utils";

/**
 * =====================================================
 * EVENT SYNC ENGINE
 * =====================================================
 *
 * Shared, resumable indexer loop used by the Purchase and Vesting syncs.
 *
 * Guarantees:
 *  1. Resumes from the last checkpoint — never re-scans from block 1.
 *  2. The first run without a configured start block only indexes the
 *     provider's queryable window and records the skipped range as an
 *     explicit gap (logged, persisted in SyncState, returned in the API).
 *  3. "Archive/Debug/Trace not available on your plan" is treated as a
 *     permanent plan limit: it clamps the range instead of retrying the
 *     same impossible request forever.
 *  4. "Block range too large" splits the range in half and makes progress.
 *  5. The checkpoint only advances after a batch is fully persisted.
 *     If any event in a batch fails, the batch is retried on the next run
 *     (handlers are idempotent by txHash) — no silent event loss.
 *  6. A run that is already in flight is not started twice.
 */

export interface CheckpointStore {
  getLastBlock(key: string): Promise<number>;
  setLastBlock(key: string, blockNumber: number): Promise<void>;
  getValue(key: string): Promise<string | null>;
  setValue(key: string, value: string): Promise<void>;
}

export interface BatchOutcome {
  /** Newly persisted events */
  processed: number;
  /** Already-known events (idempotent skip) */
  skipped: number;
  /** Events that could not be persisted */
  errors: number;
  /** Human-readable messages for the first failures (logged, not thrown) */
  errorDetails?: string[];
}

export interface EventSyncOptions<TEvent> {
  /** Log label, e.g. "Purchase sync" */
  label: string;
  /** Env var name shown in diagnostics, e.g. "SALE_START_BLOCK" */
  startBlockEnvName: string;
  stateKey: string;
  gapKey: string;
  configuredStartBlock: number | null;
  batchSize: number;
  safeLookbackBlocks: number;
  maxRetries: number;
  retryBaseDelayMs: number;
  batchDelayMs: number;
  fetchRange: (fromBlock: number, toBlock: number) => Promise<TEvent[]>;
  processEvents: (events: TEvent[]) => Promise<BatchOutcome>;
  store: CheckpointStore;
}

export interface SyncRunOutcome {
  fromBlock: number;
  toBlock: number;
  totalEvents: number;
  processed: number;
  skipped: number;
  errors: number;
  batches: number;
  duration: number;
  /** Blocks that could not be indexed on this run (provider limit / no start block) */
  gap: SyncGap | null;
  /** True when a previous run was still in flight */
  skippedRun?: boolean;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Labels of sync runs currently executing in this process. */
const inFlight = new Set<string>();

// ─── Block Timestamp Cache ─────────────────────────────────────────────────

const timestampCache = new Map<number, Date | null>();
const MAX_TIMESTAMP_CACHE = 5_000;
const TIMESTAMP_CONCURRENCY = 5;

const cacheTimestamp = (blockNumber: number, value: Date | null): void => {
  if (timestampCache.size >= MAX_TIMESTAMP_CACHE) {
    const oldest = timestampCache.keys().next().value;
    if (oldest !== undefined) timestampCache.delete(oldest);
  }
  timestampCache.set(blockNumber, value);
};

/**
 * Resolve block timestamps with a bounded cache and limited concurrency.
 * Missing/unavailable blocks map to null (never fabricated).
 */
export const resolveBlockTimestamps = async (
  blockNumbers: number[]
): Promise<Map<number, Date | null>> => {
  const result = new Map<number, Date | null>();
  const missing: number[] = [];

  for (const blockNumber of new Set(blockNumbers)) {
    if (timestampCache.has(blockNumber)) {
      result.set(blockNumber, timestampCache.get(blockNumber) ?? null);
    } else {
      missing.push(blockNumber);
    }
  }

  for (let i = 0; i < missing.length; i += TIMESTAMP_CONCURRENCY) {
    const slice = missing.slice(i, i + TIMESTAMP_CONCURRENCY);

    await Promise.all(
      slice.map(async (blockNumber) => {
        try {
          const block = await retry(() => provider.getBlock(blockNumber), {
            retries: 2,
            baseDelayMs: 500,
          });

          const value = block ? new Date(block.timestamp * 1000) : null;
          cacheTimestamp(blockNumber, value);
          result.set(blockNumber, value);
        } catch {
          cacheTimestamp(blockNumber, null);
          result.set(blockNumber, null);
        }
      })
    );
  }

  return result;
};

// ─── Run ───────────────────────────────────────────────────────────────────

export const runEventSync = async <TEvent>(
  options: EventSyncOptions<TEvent>
): Promise<SyncRunOutcome> => {
  const startedAt = Date.now();

  if (inFlight.has(options.label)) {
    logger.warn(
      { label: options.label },
      `${options.label}: previous run still in progress — skipping this tick`
    );
    return {
      fromBlock: 0,
      toBlock: 0,
      totalEvents: 0,
      processed: 0,
      skipped: 0,
      errors: 0,
      batches: 0,
      duration: 0,
      gap: null,
      skippedRun: true,
    };
  }

  inFlight.add(options.label);

  try {
    // Never index against the wrong chain: a mainnet/non-Sepolia RPC would
    // return zero logs for these contract addresses and silently advance
    // the checkpoint over real Sepolia history.
    await assertSepoliaNetwork();

    const head = await retry(() => provider.getBlockNumber(), {
      retries: options.maxRetries,
      baseDelayMs: options.retryBaseDelayMs,
      shouldRetry: isRetryableRpcError,
    });

    const checkpoint = await options.store.getLastBlock(options.stateKey);

    const resolved = resolveStartBlock({
      checkpoint,
      configuredStartBlock: options.configuredStartBlock,
      head,
      safeLookbackBlocks: options.safeLookbackBlocks,
      startBlockEnvName: options.startBlockEnvName,
    });

    let gap: SyncGap | null = resolved.gap;

    if (resolved.gap) {
      await persistGap(options, resolved.gap);
    }

    if (resolved.fromBlock > head) {
      logger.info(
        { checkpoint, head },
        `${options.label}: no new blocks to process`
      );

      return {
        fromBlock: checkpoint > 0 ? checkpoint : resolved.fromBlock,
        toBlock: head,
        totalEvents: 0,
        processed: 0,
        skipped: 0,
        errors: 0,
        batches: 0,
        duration: Date.now() - startedAt,
        gap,
      };
    }

    const fromBlock = resolved.fromBlock;
    const toBlock = head;

    logger.info(
      {
        fromBlock,
        toBlock,
        diff: toBlock - fromBlock + 1,
        batchSize: options.batchSize,
        checkpoint,
      },
      `${options.label}: starting`
    );

    let cursor = fromBlock;
    let totalEvents = 0;
    let processed = 0;
    let skipped = 0;
    let batches = 0;

    while (cursor <= toBlock) {
      const batchTo = Math.min(cursor + options.batchSize - 1, toBlock);

      let events: TEvent[];

      try {
        events = await fetchRangeAdaptive(options, cursor, batchTo);
      } catch (error: any) {
        const kind = classifyRpcError(error);

        if (kind === "PLAN_LIMIT") {
          // The provider will never serve this range. Clamp to what it can
          // serve, record the skipped prefix, and continue forward.
          const floor = queryableFloor(head, options.safeLookbackBlocks);

          const clamped = clampRangeToFloor({
            fromBlock: cursor,
            toBlock: batchTo,
            floor,
            reason: GAP_REASON_PROVIDER_WINDOW,
          });

          if (clamped.gap) {
            gap = mergeGap(gap, clamped.gap);
            await persistGap(options, clamped.gap);
          }

          if (!clamped.range) {
            // Whole batch predates the provider's log window.
            await options.store.setLastBlock(options.stateKey, batchTo);
            cursor = batchTo + 1;
            continue;
          }

          logger.warn(
            {
              requested: { fromBlock: cursor, toBlock: batchTo },
              clampedTo: clamped.range,
              floor,
            },
            `${options.label}: provider plan limit hit — clamping range`
          );

          cursor = clamped.range.fromBlock;
          continue;
        }

        logger.error(
          { batchFrom: cursor, batchTo, error: error?.message },
          `${options.label}: batch failed`
        );

        throw error;
      }

      const outcome = await options.processEvents(events);

      totalEvents += events.length;
      processed += outcome.processed;
      skipped += outcome.skipped;

      if (outcome.errors > 0) {
        const lastSafeBlock = cursor - 1;

        logger.error(
          {
            batchFrom: cursor,
            batchTo,
            failedEvents: outcome.errors,
            errorDetails: outcome.errorDetails?.slice(0, 5),
            checkpointKeptAt: lastSafeBlock,
          },
          `${options.label}: event processing failed — checkpoint NOT advanced`
        );

        throw new Error(
          `${options.label}: ${outcome.errors} event(s) in blocks ${cursor}-${batchTo} ` +
            `could not be persisted (checkpoint kept at ${lastSafeBlock}; the batch will be retried)`
        );
      }

      // Checkpoint advances only after every event in the batch is persisted.
      await options.store.setLastBlock(options.stateKey, batchTo);

      batches++;

      logger.info(
        {
          batchFrom: cursor,
          batchTo,
          events: events.length,
          processed: outcome.processed,
          skipped: outcome.skipped,
        },
        `${options.label}: batch completed`
      );

      cursor = batchTo + 1;

      if (cursor <= toBlock && options.batchDelayMs > 0) {
        await sleep(options.batchDelayMs);
      }
    }

    const duration = Date.now() - startedAt;

    logger.info(
      {
        fromBlock,
        toBlock,
        totalEvents,
        processed,
        skipped,
        batches,
        gap,
        duration,
      },
      `${options.label}: completed`
    );

    return {
      fromBlock,
      toBlock,
      totalEvents,
      processed,
      skipped,
      errors: 0,
      batches,
      duration,
      gap,
    };
  } finally {
    inFlight.delete(options.label);
  }
};

// ─── Internals ─────────────────────────────────────────────────────────────

/**
 * Fetch logs for a range, retrying transient failures and splitting the
 * range when the provider rejects it as too large.
 */
const fetchRangeAdaptive = async <TEvent>(
  options: EventSyncOptions<TEvent>,
  fromBlock: number,
  toBlock: number
): Promise<TEvent[]> => {
  try {
    return await retry(() => options.fetchRange(fromBlock, toBlock), {
      retries: options.maxRetries,
      baseDelayMs: options.retryBaseDelayMs,
      shouldRetry: isRetryableRpcError,
      onRetry: (error, attempt, delayMs) => {
        logger.warn(
          {
            fromBlock,
            toBlock,
            attempt,
            delayMs,
            error: (error as any)?.message,
          },
          `${options.label}: transient RPC error — backing off`
        );
      },
    });
  } catch (error) {
    if (classifyRpcError(error) === "RANGE_TOO_LARGE") {
      const parts = splitRange(fromBlock, toBlock);

      if (parts) {
        logger.warn(
          { fromBlock, toBlock },
          `${options.label}: block range rejected as too large — splitting`
        );

        const [left, right] = await Promise.all([
          fetchRangeAdaptive(options, parts[0].fromBlock, parts[0].toBlock),
          fetchRangeAdaptive(options, parts[1].fromBlock, parts[1].toBlock),
        ]);

        return [...left, ...right];
      }
    }

    throw error;
  }
};

/**
 * Persist + log an unindexed block range so it is never silently lost.
 */
const persistGap = async <TEvent>(
  options: EventSyncOptions<TEvent>,
  gap: SyncGap
): Promise<void> => {
  const notice = {
    ...gap,
    reason: gap.reason,
    detectedAt: new Date().toISOString(),
    hint:
      "To index these blocks, point RPC_URL at an archive-capable Sepolia provider, " +
      `set ${options.startBlockEnvName} to the contract deployment block, and delete the ` +
      `SyncState key "${options.stateKey}" so the indexer restarts from that block.`,
  };

  logger.error(
    { gap: notice },
    `${options.label}: HISTORY GAP — ${gap.fromBlock}-${gap.toBlock} blocks cannot be indexed`
  );

  await options.store.setValue(options.gapKey, JSON.stringify(notice));
};
