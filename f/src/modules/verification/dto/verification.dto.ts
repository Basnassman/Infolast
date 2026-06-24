import { z } from "zod";

const VerificationPlatformEnum = z.enum(["TELEGRAM", "X", "YOUTUBE", "DISCORD"] as const);

// ─── Create Verification Task ────────────────────────────────────────────────

export const createVerificationTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  platform: VerificationPlatformEnum,
  channelUrl: z.string().url().optional().nullable(),
  channelIdentifier: z.string().max(200).optional().nullable(),
  reward: z.number().int().min(0).max(100000).optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).strict();

export type CreateVerificationTaskDto = z.infer<typeof createVerificationTaskSchema>;

// ─── Update Verification Task ────────────────────────────────────────────────

export const updateVerificationTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  platform: VerificationPlatformEnum.optional(),
  channelUrl: z.string().url().optional().nullable(),
  channelIdentifier: z.string().max(200).optional().nullable(),
  reward: z.number().int().min(0).max(100000).optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).strict();

export type UpdateVerificationTaskDto = z.infer<typeof updateVerificationTaskSchema>;

// ─── Verify Task ─────────────────────────────────────────────────────────────

export const verifyTaskSchema = z.object({
  verificationTaskId: z.string().min(1),
}).strict();

export type VerifyTaskDto = z.infer<typeof verifyTaskSchema>;

// ─── Generate Deep Link ──────────────────────────────────────────────────────

export const generateDeepLinkSchema = z.object({
  walletAddress: z.string().min(1),
  platform: VerificationPlatformEnum,
}).strict();

export type GenerateDeepLinkDto = z.infer<typeof generateDeepLinkSchema>;

// ─── Link Account (from Telegram bot) ────────────────────────────────────────

export const linkAccountSchema = z.object({
  token: z.string().min(1),
  platformUserId: z.string().min(1),
  platformUsername: z.string().optional(),
}).strict();

export type LinkAccountDto = z.infer<typeof linkAccountSchema>;

// ─── Check Eligibility ───────────────────────────────────────────────────────

export const checkEligibilitySchema = z.object({
  walletAddress: z.string().min(1),
}).strict();

export type CheckEligibilityDto = z.infer<typeof checkEligibilitySchema>;

// ─── Wallet Query ────────────────────────────────────────────────────────────

export const verificationWalletQuerySchema = z.object({
  walletAddress: z.string().min(1),
}).strict();
