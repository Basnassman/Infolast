import { Request, Response } from "express";
import { accountLinkingService } from "@modules/verification/services/account-linking.service";
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

    // Validate the token
    const validation = await accountLinkingService.validateDeepLinkToken(token);

    if (!validation.valid || !validation.data) {
      await telegramClient.sendMessage(
        chatId,
        "❌ Invalid or expired link token. Please try again from the website."
      );
      return;
    }

    // Link the account
    const result = await accountLinkingService.linkAccount(
      validation.data.walletAddress,
      validation.data.platform,
      String(telegramUserId),
      telegramUsername
    );

    if (result.success) {
      await telegramClient.sendMessage(
        chatId,
        "✅ Your Telegram account has been linked successfully!\n\nYou can now close this chat and return to the website."
      );
    } else {
      await telegramClient.sendMessage(
        chatId,
        "❌ Failed to link your account. Please try again."
      );
    }
  } catch (err) {
    logger.error({ err }, "[TelegramWebhook] Error processing update");
  }
};
