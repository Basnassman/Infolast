import { logger } from "@core/logger/logger";

const ACCEPTED_MEMBER_STATUSES = ["member", "administrator", "creator"] as const;

export type TelegramMemberStatus = "creator" | "administrator" | "member" | "restricted" | "left" | "kicked";

export interface ChatMemberCheckResult {
  isMember: boolean;
  status: TelegramMemberStatus | null;
  error?: string;
}

/**
 * Validates whether a Telegram user is an active member of a chat.
 *
 * Accepted statuses: member, administrator, creator
 * Rejected statuses: left, kicked, restricted
 */
export const validateMemberStatus = (status: string | undefined): ChatMemberCheckResult => {
  if (!status) {
    return { isMember: false, status: null, error: "No status returned" };
  }

  const isMember = (ACCEPTED_MEMBER_STATUSES as readonly string[]).includes(status);

  return {
    isMember,
    status: status as TelegramMemberStatus,
  };
};

/**
 * Rate limiter for Telegram API calls.
 * Simple in-memory rate limiter - sufficient for moderate traffic.
 */
const callTimestamps = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 30; // max calls per window

export const checkTelegramRateLimit = (key: string = "global"): boolean => {
  const now = Date.now();
  const timestamps = callTimestamps.get(key) ?? [];

  // Remove old timestamps outside the window
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  if (recent.length >= RATE_LIMIT_MAX) {
    logger.warn({ key, count: recent.length }, "[Telegram] Rate limit exceeded");
    return false;
  }

  recent.push(now);
  callTimestamps.set(key, recent);
  return true;
};

/**
 * Parse a deep link token from a Telegram /start command.
 * Format: /start <token> or /start <token>@botUsername
 */
export const parseDeepLinkToken = (text: string | undefined): string | null => {
  if (!text) return null;

  const match = text.match(/^\/start\s+([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
};
