/**
 * =====================================================
 * RPC ERROR CLASSIFICATION (pure)
 * =====================================================
 *
 * Ethers v6 wraps JSON-RPC errors several layers deep
 * (`error.info.error.message`, `error.cause`, ...), so we collect every
 * message in the chain before matching.
 *
 * Why classification matters:
 *  - PLAN_LIMIT ("Archive, Debug and Trace requests are not available on
 *    your current plan") is NOT transient. Retrying it forever is what
 *    produced the endless "Purchase sync: batch failed" loop. It must
 *    stop immediately and trigger a range clamp.
 *  - RANGE_TOO_LARGE must be answered by splitting the block range, not
 *    by retrying the same request.
 *  - RATE_LIMITED / TRANSIENT deserve exponential backoff.
 */

export type RpcErrorKind =
  | "PLAN_LIMIT"
  | "RANGE_TOO_LARGE"
  | "RATE_LIMITED"
  | "TRANSIENT"
  | "UNKNOWN";

/** Maximum depth walked while collecting nested error messages. */
const MAX_ERROR_DEPTH = 6;

/**
 * Collect every human-readable message from an (ethers-wrapped) error.
 * Never throws — a plain string / non-object error is handled too.
 */
export const extractRpcErrorMessage = (error: unknown): string => {
  const parts: string[] = [];
  const seen = new Set<unknown>();

  let node: any = error;

  for (let depth = 0; depth < MAX_ERROR_DEPTH && node; depth++) {
    if (typeof node === "string") {
      parts.push(node);
      break;
    }

    if (typeof node !== "object" || seen.has(node)) break;
    seen.add(node);

    for (const key of ["shortMessage", "message", "reason", "details"] as const) {
      const value = (node as any)[key];
      if (typeof value === "string" && value.length > 0) parts.push(value);
    }

    // JSON-RPC error payload: { info: { error: { message } } }
    const nested =
      (node as any)?.info?.error?.message ??
      (node as any)?.error?.message ??
      (node as any)?.data?.message;

    if (typeof nested === "string") parts.push(nested);

    node = (node as any)?.cause ?? (node as any)?.error;
  }

  return [...new Set(parts)].join(" | ");
};

/** JSON-RPC error codes that mean "request range is too expensive". */
const RANGE_TOO_LARGE_CODES = new Set([-32005, -32062]);

const PLAN_LIMIT_PATTERNS: RegExp[] = [
  /archive[, ]+debug and trace requests are not available/i,
  /not available on your current plan/i,
  /requires? an? (archive|paid) (node|plan)/i,
  /archive (node|data|state).{0,40}not (available|supported|enabled)/i,
  /historical (logs?|state).{0,40}not (available|supported)/i,
  /upgrade your plan/i,
];

const RANGE_TOO_LARGE_PATTERNS: RegExp[] = [
  /block range (is )?(too (large|wide|big))/i,
  /exceeds? (the )?(max(imum)? )?(allowed )?(block )?range/i,
  /range (is )?too (large|wide|big)/i,
  /too many (blocks|logs|results)/i,
  /query returned more than \d+/i,
  /response size (limit )?exceeded/i,
  /(log|logs) response size exceeded/i,
  /limit exceeded/i,
];

const RATE_LIMIT_PATTERNS: RegExp[] = [
  /rate.?limit/i,
  /too many requests/i,
  /request limit (reached|exceeded)/i,
  /quota (exceeded|exhausted)/i,
  /\b429\b/,
];

const TRANSIENT_PATTERNS: RegExp[] = [
  /timeout/i,
  /timed out/i,
  /etimedout|econnreset|econnrefused|epipe|enotfound|eai_again/i,
  /socket hang up/i,
  /fetch failed/i,
  /network error/i,
  /temporarily unavailable/i,
  /service unavailable/i,
  /\b(502|503|504)\b/,
];

const errorCode = (error: unknown): number | undefined => {
  const node = error as any;
  const code =
    node?.code ?? node?.info?.error?.code ?? node?.error?.code;
  return typeof code === "number" ? code : undefined;
};

/**
 * Classify an RPC error into an actionable kind.
 */
export const classifyRpcError = (error: unknown): RpcErrorKind => {
  const message = extractRpcErrorMessage(error);
  const code = errorCode(error);

  // Plan limits must be checked first: some providers include the word
  // "range" in that message too.
  if (PLAN_LIMIT_PATTERNS.some((pattern) => pattern.test(message))) {
    return "PLAN_LIMIT";
  }

  if (
    (code !== undefined && RANGE_TOO_LARGE_CODES.has(code)) ||
    RANGE_TOO_LARGE_PATTERNS.some((pattern) => pattern.test(message))
  ) {
    return "RANGE_TOO_LARGE";
  }

  if (RATE_LIMIT_PATTERNS.some((pattern) => pattern.test(message))) {
    return "RATE_LIMITED";
  }

  if (TRANSIENT_PATTERNS.some((pattern) => pattern.test(message))) {
    return "TRANSIENT";
  }

  return "UNKNOWN";
};

/**
 * Only transient / rate-limited failures are worth retrying.
 * PLAN_LIMIT is permanent for the current subscription; RANGE_TOO_LARGE
 * is handled by splitting the range, not by repeating the request.
 */
export const isRetryableRpcError = (error: unknown): boolean => {
  const kind = classifyRpcError(error);
  return kind === "TRANSIENT" || kind === "RATE_LIMITED" || kind === "UNKNOWN";
};
