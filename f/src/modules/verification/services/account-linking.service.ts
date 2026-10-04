import { VerificationPlatform } from "@prisma/client";
import {
  platformAccountRepository as corePlatformAccountRepository,
} from "../repositories/platform-account.repository";
import { prisma } from "@core/db/prisma";
import { env } from "@core/config/env";
import { logger } from "@core/logger/logger";
import { getOrCreateUser } from "@modules/user/utils/user";
import { PlatformAccountAlreadyLinkedError } from "../errors/verification.errors";
import {
  verificationTokenService as coreVerificationTokenService,
  VerificationTokenRecord,
} from "./verification.token.service";

/**
 * =====================================================
 * ACCOUNT LINKING SERVICE
 * =====================================================
 *
 * Handles linking external platform accounts (Telegram, X, etc.)
 * to wallet-based users via Deep Link tokens.
 *
 * Telegram Deep Link Flow (Phase 2 — I.1 + I.2):
 * 1. Frontend requests a link token → backend resolves the REAL User.id
 *    (never the raw wallet address) and stores a single-use token in cache
 * 2. Returns deep link URL: https://t.me/BotName?start=TOKEN
 * 3. User clicks the link in Telegram
 * 4. Bot receives /start command with token
 * 5. Bot validates the token (read-only)
 * 6. Bot ATOMICALLY consumes the token (single-use — CREATE → VALIDATE →
 *    ATOMIC CONSUME → LINK) with the Telegram identity (telegramUserId)
 * 7. PlatformAccount row is created: User.id ↔ telegramUserId
 *
 * The token lifecycle itself lives in verification.token.service.ts —
 * this service only orchestrates it (one source of truth for tokens).
 */

/**
 * Build platform-specific deep link URL.
 */
const buildDeepLinkUrl = (platform: VerificationPlatform, token: string): string => {
  switch (platform) {
    case VerificationPlatform.TELEGRAM: {
      const botUsername = env.telegram.botUsername || "bot";
      return `https://t.me/${botUsername}?start=${token}`;
    }
    case VerificationPlatform.X:
      return `${env.appUrl}/verify/x?token=${token}`;
    case VerificationPlatform.YOUTUBE:
      return `${env.appUrl}/verify/youtube?token=${token}`;
    case VerificationPlatform.DISCORD:
      return `${env.appUrl}/verify/discord?token=${token}`;
    default:
      return `${env.appUrl}/verify/${platform}?token=${token}`;
  }
};

/**
 * Dependencies are declared as properties so tests can swap them for fakes.
 * Always call methods on the service object (not destructured).
 */
export const accountLinkingService = {
  platformAccountRepository: corePlatformAccountRepository,
  verificationTokenService: coreVerificationTokenService,
  resolveUser: getOrCreateUser,

  /**
   * Generate a deep link token for platform account linking.
   *
   * I.1: the token is bound to the REAL User.id. The wallet address is only
   * used to resolve the user — it is never used as (or stored in place of)
   * User.id, and it is never stored inside the token record.
   *
   * The token is single-use with a 600 second TTL (I.2).
   * The frontend should open the returned URL in a new window.
   */
  async generateDeepLink(
    walletAddress: string,
    platform: VerificationPlatform
  ): Promise<{
    deepLinkUrl: string;
    token: string;
    expiresAt: Date;
  }> {
    // Resolve the real User row for this wallet (creates it on first use,
    // same helper the rest of the verification controller uses).
    const user = await this.resolveUser(walletAddress);

    // Check if already linked (informational only)
    const existing = await this.platformAccountRepository.findByUserAndPlatform(
      user.id,
      platform
    );

    if (existing?.verified) {
      logger.info(
        { userId: user.id, platform },
        "[AccountLinking] Account already linked, generating re-link token"
      );
    }

    // Single-use token bound to User.id (I.1/I.2)
    const { token, expiresAt } = await this.verificationTokenService.generate(
      user.id,
      platform
    );

    const deepLinkUrl = buildDeepLinkUrl(platform, token);

    logger.info(
      { userId: user.id, platform, expiresAt },
      "[AccountLinking] Deep link token generated"
    );

    return { deepLinkUrl, token, expiresAt };
  },

  /**
   * Read-only token validation (does NOT consume the token).
   * Linking only happens after verificationTokenService.consume().
   */
  async validateDeepLinkToken(
    token: string
  ): Promise<{ valid: boolean; data?: VerificationTokenRecord; error?: string }> {
    return this.verificationTokenService.validate(token);
  },

  /**
   * Complete the account linking after the token has been atomically
   * consumed by the caller (Telegram bot webhook).
   *
   * @param userId - The REAL User.id (NOT a wallet address).  (I.1)
   * @param platformUserId - The platform identity (telegramUserId — the
   *   numeric Telegram id; username is never used as identity).  (I.11)
   */
  async linkAccount(
    userId: string,
    platform: VerificationPlatform,
    platformUserId: string,
    platformUsername?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Duplicate-linking guard: one platform identity may only ever be
      // bound to a single user.
      const alreadyLinked =
        await this.platformAccountRepository.findByPlatformUserId(
          platform,
          platformUserId
        );

      if (alreadyLinked && alreadyLinked.userId !== userId) {
        logger.warn(
          { userId, linkedUserId: alreadyLinked.userId, platform, platformUserId },
          "[AccountLinking] Rejected link: platform identity already bound to another user"
        );
        return {
          success: false,
          error: "This Telegram account is already linked to another account",
        };
      }

      await this.platformAccountRepository.link({
        userId,
        platform,
        platformUserId,
        platformUsername,
      });

      logger.info(
        { userId, platform, platformUserId },
        "[AccountLinking] Platform account linked successfully"
      );

      return { success: true };
    } catch (err: any) {
      // ── Database-level uniqueness = final concurrency boundary ──
      // The application guard above can be raced (TOCTOU). If two requests
      // both pass the guard, exactly one INSERT wins and the loser receives
      // a unique violation from `@@unique([platform, platformUserId])`.
      // Convert it to the existing typed application-level error — a raw
      // Prisma/database error must never reach the caller.  (Phase 2.2)
      if (err?.code === "P2002") {
        const typedError = new PlatformAccountAlreadyLinkedError(userId, platform);
        const target = err?.meta?.target;
        const fields: string[] = Array.isArray(target)
          ? target
          : typeof target === "string"
            ? [target]
            : [];
        const identityConflict = fields.includes("platformUserId");

        logger.warn(
          {
            userId,
            platform,
            platformUserId,
            conflictTarget: fields,
            error: typedError.code,
          },
          "[AccountLinking] Unique constraint rejected a concurrent duplicate link"
        );

        return {
          success: false,
          error: identityConflict
            ? "This Telegram account is already linked to another account"
            : "This account is already linked",
        };
      }

      logger.error(
        { err, userId, platform },
        "[AccountLinking] Failed to link account"
      );
      return { success: false, error: "Failed to link account" };
    }
  },

  /**
   * Get linked accounts for a user (wallet → real User.id → accounts).
   */
  async getLinkedAccounts(walletAddress: string) {
    const user = await prisma.user.findUnique({
      where: { walletAddress: walletAddress.toLowerCase() },
      select: { id: true },
    });

    if (!user) return [];

    return this.platformAccountRepository.findByUser(user.id);
  },

  /**
   * Unlink a platform account (wallet → real User.id → delete).
   */
  async unlinkAccount(
    walletAddress: string,
    platform: VerificationPlatform
  ): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { walletAddress: walletAddress.toLowerCase() },
      select: { id: true },
    });

    if (user) {
      await this.platformAccountRepository.unlink(user.id, platform);
      logger.info(
        { walletAddress, platform },
        "[AccountLinking] Platform account unlinked"
      );
    }
  },
};
