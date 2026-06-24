import { VerificationPlatform, VerificationStatus, VerificationAction, VerificationResultStatus } from "@prisma/client";

// ─── Result Types ────────────────────────────────────────────────────────────

export interface VerificationResult {
  success: boolean;
  isMember: boolean;
  status?: string;
  error?: string;
  details?: Record<string, unknown>;
}

// ─── Provider Types ──────────────────────────────────────────────────────────

export interface VerifyContext {
  userId: string;
  taskId: string;
  platform: VerificationPlatform;
  channelIdentifier?: string;
  channelUrl?: string;
  metadata?: Record<string, unknown>;
}

// ─── Eligibility Types ───────────────────────────────────────────────────────

export interface EligibilityCheckResult {
  eligible: boolean;
  reason?: string;
  verifiedAt?: Date;
  lastCheckedAt?: Date;
}

export interface BulkEligibilityCheckResult {
  eligible: boolean;
  failedTasks: Array<{
    taskId: string;
    title: string;
    platform: VerificationPlatform;
    reason: string;
  }>;
}

// ─── Account Linking Types ───────────────────────────────────────────────────

export interface DeepLinkToken {
  walletAddress: string;
  platform: VerificationPlatform;
  createdAt: number;
}

export interface LinkAccountResult {
  success: boolean;
  deepLinkUrl?: string;
  token?: string;
  expiresAt?: Date;
  error?: string;
}

// ─── Reverification Types ────────────────────────────────────────────────────

export interface ReverificationResult {
  userId: string;
  verificationTaskId: string;
  previousStatus: VerificationStatus;
  newStatus: VerificationStatus;
  changed: boolean;
  error?: string;
}

export interface ReverificationBatchResult {
  total: number;
  verified: number;
  revoked: number;
  failed: number;
  results: ReverificationResult[];
}

// ─── Cache Key Builders ──────────────────────────────────────────────────────

export const verificationCacheKeys = {
  memberCheck: (platform: string, channelIdentifier: string, platformUserId: string) =>
    `verification:${platform}:${channelIdentifier}:${platformUserId}`,

  eligibility: (userId: string) =>
    `verification:eligibility:${userId}`,

  deepLinkToken: (token: string) =>
    `verification:deeplink:${token}`,

  rateLimit: (userId: string) =>
    `verification:ratelimit:${userId}`,
};

export const VERIFICATION_CACHE_TTL = {
  memberCheck: 900, // 15 minutes
  eligibility: 300, // 5 minutes
  deepLinkToken: 600, // 10 minutes
  rateLimit: 60, // 1 minute
} as const;
