import { computeBackoffDelay } from "./sync-utils";

/**
 * =====================================================
 * RETRY
 * =====================================================
 *
 * Retries with exponential backoff + jitter, and an optional predicate so
 * permanent errors (e.g. "not available on your current plan") fail fast
 * instead of being retried on every cron tick.
 *
 * Backwards compatible: retry(fn, 3, 2000) still works.
 */

export interface RetryOptions {
  /** Total attempts (including the first one). Default: 3 */
  retries?: number;
  /** Base delay for exponential backoff. Default: 1000ms */
  baseDelayMs?: number;
  /** Upper bound for a single delay. Default: 30000ms */
  maxDelayMs?: number;
  /** Return false to abort immediately (non-retryable error). */
  shouldRetry?: (error: unknown) => boolean;
  /** Called after a failed attempt, before sleeping. */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const normalizeOptions = (
  attemptsOrOptions: number | RetryOptions,
  delayMs: number
): Required<Pick<RetryOptions, "retries" | "baseDelayMs" | "maxDelayMs">> &
  Pick<RetryOptions, "shouldRetry" | "onRetry"> => {
  if (typeof attemptsOrOptions === "number") {
    return {
      retries: Math.max(1, attemptsOrOptions),
      baseDelayMs: delayMs,
      maxDelayMs: Math.max(delayMs * 8, 5_000),
    };
  }

  return {
    retries: Math.max(1, attemptsOrOptions.retries ?? 3),
    baseDelayMs: Math.max(1, attemptsOrOptions.baseDelayMs ?? delayMs),
    maxDelayMs: Math.max(1, attemptsOrOptions.maxDelayMs ?? 30_000),
    shouldRetry: attemptsOrOptions.shouldRetry,
    onRetry: attemptsOrOptions.onRetry,
  };
};

export const retry = async <T>(
  fn: () => Promise<T>,
  attemptsOrOptions: number | RetryOptions = 3,
  delayMs = 1_000
): Promise<T> => {
  const options = normalizeOptions(attemptsOrOptions, delayMs);

  let lastError: unknown;

  for (let attempt = 0; attempt < options.retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      const isLastAttempt = attempt === options.retries - 1;

      if (isLastAttempt) break;
      if (options.shouldRetry && !options.shouldRetry(error)) break;

      const backoff = computeBackoffDelay(
        attempt,
        options.baseDelayMs,
        options.maxDelayMs
      );

      options.onRetry?.(error, attempt + 1, backoff);

      await sleep(backoff);
    }
  }

  throw lastError;
};
