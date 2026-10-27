/**
 * =====================================================
 * SYNC RANGE UTILITIES (pure)
 * =====================================================
 *
 * All block-range decision making lives here without any I/O so it can be
 * unit tested. The indexers (Purchase / Vesting) previously started at
 * block 1 on every run because no checkpoint existed and the first batch
 * always failed — these helpers make resuming explicit and safe.
 */

export type SyncGap = {
  fromBlock: number;
  toBlock: number;
  reason: string;
};

export const GAP_REASON_NO_START_BLOCK =
  "No start block configured — only the provider's recent log window is indexed";

export const GAP_REASON_PROVIDER_WINDOW =
  "RPC provider refuses historical eth_getLogs on the current plan";

/**
 * First block that is still queryable on a provider that only keeps the
 * last `safeLookbackBlocks` of logs.
 */
export const queryableFloor = (
  head: number,
  safeLookbackBlocks: number
): number => Math.max(1, head - Math.max(1, safeLookbackBlocks) + 1);

/**
 * Merge two gaps into one (union of ranges, both reasons kept).
 */
export const mergeGap = (
  a: SyncGap | null,
  b: SyncGap | null
): SyncGap | null => {
  if (!a) return b;
  if (!b) return a;

  return {
    fromBlock: Math.min(a.fromBlock, b.fromBlock),
    toBlock: Math.max(a.toBlock, b.toBlock),
    reason:
      a.reason === b.reason ? a.reason : `${a.reason}; ${b.reason}`,
  };
};

export interface ResolveStartBlockInput {
  /** Last successfully processed block (0 = no checkpoint yet) */
  checkpoint: number;
  /** Deployment block from env, if configured */
  configuredStartBlock: number | null;
  /** Current chain head */
  head: number;
  safeLookbackBlocks: number;
  /** Label used inside the gap reason (e.g. "SALE_START_BLOCK") */
  startBlockEnvName: string;
}

export interface ResolveStartBlockResult {
  fromBlock: number;
  /** Non-null when older blocks are skipped on this first run */
  gap: SyncGap | null;
}

/**
 * Decide where this run starts.
 *
 * Priority:
 *  1. Existing checkpoint → resume from the next block (never rescan).
 *  2. Configured deployment block → full history from there.
 *  3. Nothing configured → first run indexes only the queryable window
 *     and records the skipped range as an explicit gap (no silent loss).
 */
export const resolveStartBlock = ({
  checkpoint,
  configuredStartBlock,
  head,
  safeLookbackBlocks,
  startBlockEnvName,
}: ResolveStartBlockInput): ResolveStartBlockResult => {
  if (checkpoint > 0) {
    return { fromBlock: checkpoint + 1, gap: null };
  }

  if (configuredStartBlock !== null && configuredStartBlock > 0) {
    return {
      fromBlock: Math.min(configuredStartBlock, head),
      gap: null,
    };
  }

  const fromBlock = queryableFloor(head, safeLookbackBlocks);

  return {
    fromBlock,
    gap:
      fromBlock > 1
        ? {
            fromBlock: 1,
            toBlock: fromBlock - 1,
            reason: `${startBlockEnvName} is not configured — ${GAP_REASON_NO_START_BLOCK}`,
          }
        : null,
  };
};

export interface ClampRangeInput {
  fromBlock: number;
  toBlock: number;
  floor: number;
  reason?: string;
}

export interface ClampRangeResult {
  /** Range that can actually be requested, or null if all of it is too old */
  range: { fromBlock: number; toBlock: number } | null;
  /** Blocks that have to be skipped */
  gap: SyncGap | null;
}

/**
 * Clamp a requested batch to blocks the provider can still serve.
 *
 * - whole batch older than the floor → range null + gap
 * - batch straddles the floor        → range clamped + gap for the prefix
 * - batch fully inside the window    → unchanged
 */
export const clampRangeToFloor = ({
  fromBlock,
  toBlock,
  floor,
  reason = GAP_REASON_PROVIDER_WINDOW,
}: ClampRangeInput): ClampRangeResult => {
  if (toBlock < floor) {
    return {
      range: null,
      gap: { fromBlock, toBlock, reason },
    };
  }

  if (fromBlock < floor) {
    return {
      range: { fromBlock: floor, toBlock },
      gap: { fromBlock, toBlock: floor - 1, reason },
    };
  }

  return { range: { fromBlock, toBlock }, gap: null };
};

/**
 * Deterministic exponential backoff with jitter.
 *
 * @param attempt 0-based attempt index.
 */
export const computeBackoffDelay = (
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  random: number = Math.random()
): number => {
  const exponential = baseDelayMs * Math.pow(2, Math.max(0, attempt));
  const capped = Math.min(maxDelayMs, exponential);
  const jitter = 0.5 + Math.min(Math.max(random, 0), 1) * 0.5;
  return Math.round(capped * jitter);
};

/**
 * Split a block range in half (used after RANGE_TOO_LARGE responses).
 * Returns null when the range cannot be split further.
 */
export const splitRange = (
  fromBlock: number,
  toBlock: number
): [{ fromBlock: number; toBlock: number }, { fromBlock: number; toBlock: number }] | null => {
  if (toBlock <= fromBlock) return null;

  const mid = fromBlock + Math.floor((toBlock - fromBlock) / 2);

  return [
    { fromBlock, toBlock: mid },
    { fromBlock: mid + 1, toBlock },
  ];
};
