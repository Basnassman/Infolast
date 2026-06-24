import { VerificationPlatform } from "@prisma/client";
import { VerificationProvider } from "../../interfaces/verification-provider.interface";
import { VerifyContext, VerificationResult } from "../../types/verification.types";
import { telegramClient } from "@core/telegram/telegram.client";
import { validateMemberStatus } from "@core/telegram/telegram.adapter";
import { cacheService } from "@core/cache/cache.service";
import { verificationCacheKeys, VERIFICATION_CACHE_TTL } from "../../types/verification.types";
import { logger } from "@core/logger/logger";

/**
 * Telegram Verification Provider
 *
 * Verifies that a user is a member of a Telegram group/channel.
 *
 * Flow:
 * 1. Look up the user's linked Telegram account (platformUserId)
 * 2. Call Telegram Bot API getChatMember(chatId, userId)
 * 3. Check status is one of: member, administrator, creator
 *
 * Anti-fraud:
 * - Results are cached for 15 minutes to prevent rapid re-verification
 * - Cache is invalidated on reverification checks
 */
export class TelegramProvider implements VerificationProvider {
  readonly platform = VerificationPlatform.TELEGRAM;

  async verify(context: VerifyContext): Promise<VerificationResult> {
    const { channelIdentifier } = context;

    if (!channelIdentifier) {
      return {
        success: false,
        isMember: false,
        error: "No channel identifier configured for this verification task",
      };
    }

    // Get platform user ID from context metadata
    const platformUserId = context.metadata?.platformUserId as string | undefined;
    if (!platformUserId) {
      return {
        success: false,
        isMember: false,
        error: "Telegram account not linked. Please link your Telegram account first.",
      };
    }

    const userIdNum = parseInt(platformUserId, 10);
    if (isNaN(userIdNum)) {
      return {
        success: false,
        isMember: false,
        error: "Invalid Telegram user ID",
      };
    }

    // Check cache first
    const cacheKey = verificationCacheKeys.memberCheck(
      this.platform,
      channelIdentifier,
      platformUserId
    );

    const cached = await cacheService.get<VerificationResult>(cacheKey);
    if (cached) {
      logger.debug(
        { userId: context.userId, channelIdentifier },
        "[Telegram] Using cached verification result"
      );
      return cached;
    }

    // Call Telegram API
    const response = await telegramClient.getChatMember(channelIdentifier, userIdNum);

    if (!response.ok) {
      logger.warn(
        { userId: context.userId, channelIdentifier, description: response.description },
        "[Telegram] getChatMember failed"
      );
      return {
        success: false,
        isMember: false,
        error: response.description || "Failed to check Telegram membership",
      };
    }

    const { isMember, status } = validateMemberStatus(response.result?.status);

    const result: VerificationResult = {
      success: true,
      isMember,
      status: status ?? undefined,
      details: {
        channelIdentifier,
        platformUserId,
        chatMemberStatus: response.result?.status,
      },
    };

    // Cache the result
    await cacheService.set(cacheKey, result, VERIFICATION_CACHE_TTL.memberCheck);

    logger.info(
      {
        userId: context.userId,
        channelIdentifier,
        platformUserId,
        isMember,
        status,
      },
      "[Telegram] Verification result"
    );

    return result;
  }

  async checkMembership(channelIdentifier: string, platformUserId: string): Promise<boolean> {
    const userIdNum = parseInt(platformUserId, 10);
    if (isNaN(userIdNum)) return false;

    const response = await telegramClient.getChatMember(channelIdentifier, userIdNum);
    if (!response.ok) return false;

    const { isMember } = validateMemberStatus(response.result?.status);
    return isMember;
  }
}
