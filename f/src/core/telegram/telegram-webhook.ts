import { Request, Response } from "express";
import { accountLinkingService } from "@modules/verification/services/account-linking.service";
import { verificationTokenService } from "@modules/verification/services/verification.token.service";
import {
  DeepLinkTokenAlreadyUsedError,
  DeepLinkTokenUserMismatchError,
  TelegramIdentityMismatch,
} from "@modules/verification/errors/verification.errors";
import { parseDeepLinkToken } from "@core/telegram/telegram.adapter";
import { telegramClient } from "@core/telegram/telegram.client";
import { env } from "@core/config/env";
import { logger } from "@core/logger/logger";

/**
 * =====================================================
 * TELEGRAM WEBHOOK HANDLER
 * =====================================================
 *
 * Handles incoming Telegram bot updates (messages).
 * Processes /start commands for deep link account linking.
 *
 * Deep-link security flow (I.1 + I.2 + I.11):
 *   token received
 *     → VALIDATE (read-only: existence + expiry)
 *     → ATOMIC CONSUME (single-use GETDEL, user + platform + telegramUserId
 *       binding — a concurrent replay loses and fails)
 *     → LINK (PlatformAccount: REAL User.id ↔ telegramUserId)
 *
 * Setup:
 * 1. Set webhook: POST https://api.telegram.org/bot<TOKEN>/setWebhook?url=<YOUR_URL>/api/v1/telegram/webhook
 * 2. Configure TELEGRAM_BOT_USERNAME in env
 */
export const telegramWebhookHandler = async (req: Request, res: Response) => {
  try {
    // Validate secret token (X-Telegram-Bot-Api-Secret-Token header)
    const secretToken = req.headers["x-telegram-bot-api-secret-token"] as string | undefined;
    const expectedSecret = env.telegram.webhookSecret;
    if (expectedSecret && secretToken !== expectedSecret) {
      res.sendStatus(403);
      return;
    }

    const update = req.body;

    // Respond immediately to Telegram (must respond within 30s)
    res.sendStatus(200);

    // Only process message updates
    if (!update.message) return;

    const message = update.message;
    const text = message.text as string | undefined;
    const chatId = message.chat.id as number;
    const telegramUserId = message.from?.id as number;
    const telegramUsername = message.from?.username as string | undefined;

    if (!text || !telegramUserId) return;

    // Handle /start command
    const token = parseDeepLinkToken(text);
    if (!token) return;

    logger.info(
      { chatId, telegramUserId, token: token.substring(0, 8) + "..." },
      "[TelegramWebhook] Received deep link token"
    );

    // 1) VALIDATE — read-only pre-check (does NOT consume the token).
    const validation = await verificationTokenService.validate(token);

    if (!validation.valid || !validation.data) {
      logger.warn(
        { chatId, telegramUserId, token: token.substring(0, 8) + "...", reason: validation.error },
        "[TelegramWebhook] Invalid or expired deep link token"
      );
      await telegramClient.sendMessage(
        chatId,
        "❌ Invalid or expired link token. Please try again from the website."
      );
      return;
    }

    // 2) ATOMIC CONSUME — single-use; the token is bound to one User.id and
    //    to this specific telegramUserId (identity = numeric id, never
    //    username). A replay or an identity/user mismatch throws a typed
    //    error and never links twice.
    let consumed;
    try {
      consumed = await verificationTokenService.consume(token, {
        userId: validation.data.userId,
        platform: validation.data.platform,
        telegramUserId: String(telegramUserId),
        telegramUsername,
      });
    } catch (err) {
      if (err instanceof DeepLinkTokenAlreadyUsedError) {
        logger.warn(
          { chatId, telegramUserId, token: token.substring(0, 8) + "..." },
          "[TelegramWebhook] Token replay rejected (already used)"
        );
        await telegramClient.sendMessage(
          chatId,
          "❌ This link has already been used. Please request a new link on the website."
        );
        return;
      }

      if (err instanceof TelegramIdentityMismatch) {
        logger.warn(
          { chatId, telegramUserId, token: token.substring(0, 8) + "..." },
          "[TelegramWebhook] Telegram identity mismatch rejected"
        );
        await telegramClient.sendMessage(
          chatId,
          "❌ This link belongs to a different Telegram account. Please start the verification from your own account."
        );
        return;
      }

      if (err instanceof DeepLinkTokenUserMismatchError) {
        logger.warn(
          { chatId, telegramUserId, token: token.substring(0, 8) + "..." },
          "[TelegramWebhook] Token user mismatch rejected"
        );
        await telegramClient.sendMessage(
          chatId,
          "❌ This link token does not match your session. Please try again from the website."
        );
        return;
      }

      throw err;
    }

    if (!consumed.success) {
      await telegramClient.sendMessage(
        chatId,
        "❌ Invalid or expired link token. Please try again from the website."
      );
      return;
    }

    // 3) LINK — PlatformAccount row keyed by the REAL User.id (I.1).
    //    The wallet address is never used as User.id anywhere in this flow.
    const result = await accountLinkingService.linkAccount(
      consumed.data.userId,
      consumed.data.platform,
      String(telegramUserId),
      telegramUsername
    );

    if (result.success) {
      logger.info(
        { chatId, telegramUserId, platform: consumed.data.platform },
        "[TelegramWebhook] Deep link consumed and account linked"
      );
      await telegramClient.sendMessage(
        chatId,
        "✅ Your Telegram account has been linked successfully!\n\nYou can now close this chat and return to the website."
      );
    } else {
      logger.warn(
        { chatId, telegramUserId, platform: consumed.data.platform, reason: result.error },
        "[TelegramWebhook] Account linking rejected"
      );
      await telegramClient.sendMessage(
        chatId,
        `❌ ${result.error || "Failed to link your account. Please try again."}`
      );
    }
  } catch (err) {
    logger.error({ err }, "[TelegramWebhook] Error processing update");
  }
};
