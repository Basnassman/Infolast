import { env } from "@core/config/env";
import { logger } from "@core/logger/logger";

/**
 * Low-level Telegram Bot API client.
 * All Telegram API calls go through this client.
 */
const getBotToken = (): string => {
  const token = env.telegram.botToken;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  return token;
};

const getBaseUrl = (): string => `https://api.telegram.org/bot${getBotToken()}`;

export const telegramClient = {

  async getChatMember(
    chatId: string,
    userId: number
  ): Promise<{
    ok: boolean;
    result?: {
      status: "creator" | "administrator" | "member" | "restricted" | "left" | "kicked";
      user: { id: number; is_bot: boolean; first_name: string; username?: string };
    };
    description?: string;
  }> {
    try {
      const url = `${getBaseUrl()}/getChatMember?chat_id=${encodeURIComponent(chatId)}&user_id=${userId}`;
      const res = await fetch(url);
      const data = await res.json();
      return data;
    } catch (err) {
      logger.error({ err, chatId, userId }, "[Telegram] getChatMember failed");
      return { ok: false, description: "API request failed" };
    }
  },

  async getMe(): Promise<{ ok: boolean; result?: { id: number; username: string; first_name: string }; description?: string }> {
    try {
      const res = await fetch(`${getBaseUrl()}/getMe`);
      return await res.json();
    } catch (err) {
      logger.error({ err }, "[Telegram] getMe failed");
      return { ok: false, description: "API request failed" };
    }
  },

  async setWebhook(url: string, secretToken?: string): Promise<{ ok: boolean; description?: string }> {
    try {
      const body: Record<string, unknown> = { url };
      if (secretToken) body.secret_token = secretToken;
      const res = await fetch(`${getBaseUrl()}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return await res.json();
    } catch (err) {
      logger.error({ err }, "[Telegram] setWebhook failed");
      return { ok: false, description: "API request failed" };
    }
  },

  async sendMessage(
    chatId: number | string,
    text: string,
    options?: { parse_mode?: string; reply_markup?: unknown }
  ): Promise<{ ok: boolean; result?: unknown; description?: string }> {
    try {
      const body: Record<string, unknown> = { chat_id: chatId, text };
      if (options?.parse_mode) body.parse_mode = options.parse_mode;
      if (options?.reply_markup) body.reply_markup = options.reply_markup;
      const res = await fetch(`${getBaseUrl()}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return await res.json();
    } catch (err) {
      logger.error({ err, chatId }, "[Telegram] sendMessage failed");
      return { ok: false, description: "API request failed" };
    }
  },
};
