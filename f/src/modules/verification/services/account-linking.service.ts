import crypto from "crypto";
import { VerificationPlatform } from "@prisma/client";
import { platformAccountRepository } from "../repositories/platform-account.repository";
import { cacheService } from "@core/cache/cache.service";
import { verificationCacheKeys, VERIFICATION_CACHE_TTL, DeepLinkToken } from "../types/verification.types";
import { prisma } from "@core/db/prisma";
import { env } from "@core/config/env";
import { logger } from "@core/logger/logger";

/**
 * =====================================================
 * ACCOUNT LINKING SERVICE
 * =====================================================
 *
 * Handles linking external platform accounts (Telegram, X, etc.)
 * to wallet-based users via Deep Link tokens.
 *
 * Telegram Deep Link Flow:
 * 1. Frontend requests a link token → backend generates + stores in Redis
 * 2. Returns deep link URL: https://t.me/BotName?start=TOKEN
 * 3. User clicks the link in Telegram
 * 4. Bot receives /start command with token
 * 5. Bot validates token against Redis
 * 6. Bot links telegramUserId to the wallet address
 * 7. Stores in PlatformAccount table
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

export const accountLinkingService = {
  /**
   * Generate a deep link token for platform account linking.
   *
   * The token is stored in Redis with a TTL (default: 10 minutes).
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
    const normalizedWallet = walletAddress.toLowerCase();

    // Check if already linked
    const existing = await platformAccountRepository.findByUserAndPlatform(
      normalizedWallet,
      platform
    );

    if (existing?.verified) {
      logger.info(
        { walletAddress: normalizedWallet, platform },
        "[AccountLinking] Account already linked, generating re-link token"
      );
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString("base64url");

    // Store in Redis
    const tokenData: DeepLinkToken = {
      walletAddress: normalizedWallet,
      platform,
      createdAt: Date.now(),
    };

    const cacheKey = verificationCacheKeys.deepLinkToken(token);
    await cacheService.set(cacheKey, tokenData, VERIFICATION_CACHE_TTL.deepLinkToken);

    const expiresAt = new Date(Date.now() + VERIFICATION_CACHE_TTL.deepLinkToken * 1000);

    // Build deep link URL based on platform
    const deepLinkUrl = buildDeepLinkUrl(platform, token);

    logger.info(
      { walletAddress: normalizedWallet, platform, expiresAt },
      "[AccountLinking] Deep link token generated"
    );

    return { deepLinkUrl, token, expiresAt };
  },

  /**
   * Validate a deep link token and return the associated data.
   * Does NOT consume the token — call linkAccount() after validation.
   */
  async validateDeepLinkToken(
    token: string
  ): Promise<{ valid: boolean; data?: DeepLinkToken; error?: string }> {
    const cacheKey = verificationCacheKeys.deepLinkToken(token);
    const data = await cacheService.get<DeepLinkToken>(cacheKey);

    if (!data) {
      return { valid: false, error: "Token not found or expired" };
    }

    // Check expiry
    const age = Date.now() - data.createdAt;
    if (age > VERIFICATION_CACHE_TTL.deepLinkToken * 1000) {
      await cacheService.del(cacheKey);
      return { valid: false, error: "Token expired" };
    }

    return { valid: true, data };
  },

  /**
   * Complete the account linking after token validation.
   *
   * Called by the Telegram bot webhook handler after validating
   * the /start command token.
   */
  async linkAccount(
    walletAddress: string,
    platform: VerificationPlatform,
    platformUserId: string,
    platformUsername?: string
  ): Promise<{ success: boolean; error?: string }> {
    const normalizedWallet = walletAddress.toLowerCase();

    try {
      await platformAccountRepository.link({
        userId: normalizedWallet,
        platform,
        platformUserId,
        platformUsername,
      });

      logger.info(
        { walletAddress: normalizedWallet, platform, platformUserId },
        "[AccountLinking] Platform account linked successfully"
      );

      return { success: true };
    } catch (err) {
      logger.error(
        { err, walletAddress: normalizedWallet, platform },
        "[AccountLinking] Failed to link account"
      );
      return { success: false, error: "Failed to link account" };
    }
  },

  /**
   * Get linked accounts for a user.
   */
  async getLinkedAccounts(walletAddress: string) {
    const normalizedWallet = walletAddress.toLowerCase();

    const user = await prisma.user.findUnique({
      where: { walletAddress: normalizedWallet },
      select: { id: true },
    });

    if (!user) return [];

    return platformAccountRepository.findByUser(user.id);
  },

  /**
   * Unlink a platform account.
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
      await platformAccountRepository.unlink(user.id, platform);
      logger.info(
        { walletAddress, platform },
        "[AccountLinking] Platform account unlinked"
      );
    }
  },
};
