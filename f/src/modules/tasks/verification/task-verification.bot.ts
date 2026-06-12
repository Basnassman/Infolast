import { Task, TaskPlatform } from "@prisma/client";
import { env } from "@core/config/env";

const TWITTER_BEARER_TOKEN = env.verification.twitterBearerToken;
const TELEGRAM_BOT_TOKEN   = env.telegram.botToken;
const TELEGRAM_GROUP_ID    = env.telegram.groupId;
const YOUTUBE_API_KEY      = env.verification.youtubeApiKey;
const YOUTUBE_CHANNEL_ID   = env.verification.youtubeChannelId;

/**
 * 🤖 Task Verification Bot - REAL APIs
 */
export const verifyTaskExecution = async (task: Task, proof?: any): Promise<boolean> => {
  switch (task.platform) {
    case TaskPlatform.X:
      return await verifyXTask(task, proof);
    case TaskPlatform.TELEGRAM:
      return await verifyTelegramTask(task, proof);
    case TaskPlatform.YOUTUBE:
      return await verifyYouTubeTask(task, proof);
    case TaskPlatform.ARTICLE:
      return await verifyArticleTask(task, proof);
    default:
      return false;
  }
};

// ─── X (Twitter) Verification ───────────────────────────────────────────────

const verifyXTask = async (task: Task, proof: any): Promise<boolean> => {
  if (!TWITTER_BEARER_TOKEN) {
    console.warn("[VERIFY] TWITTER_BEARER_TOKEN not set");
    return false;
  }

  const username = proof?.username;
  
  if (!username) {
    console.log("[VERIFY] X: no username provided");
    return false;
  }

  // ✅ FIX: تحقق من وجود URL
  if (!task.url) {
    console.log("[VERIFY] X: task has no URL");
    return false;
  }

  try {
    const userRes = await fetch(
      `https://api.twitter.com/2/users/by/username/${username.replace('@', '')}`,
      {
        headers: { Authorization: `Bearer ${TWITTER_BEARER_TOKEN}` }
      }
    );

    if (!userRes.ok) {
      console.log("[VERIFY] X: user not found");
      return false;
    }

    const userData = await userRes.json();
    const targetUserId = userData.data?.id;

    if (!targetUserId) return false;

    if (task.id.includes("retweet") || task.id.includes("like")) {
      const tweetId = extractTweetId(task.url); // ✅ الآن task.url مضمون string

      if (!tweetId) {
        console.log("[VERIFY] X: invalid tweet URL");
        return false;
      }

      const retweetsRes = await fetch(
        `https://api.twitter.com/2/tweets/${tweetId}/retweeted_by`,
        {
          headers: { Authorization: `Bearer ${TWITTER_BEARER_TOKEN}` }
        }
      );

      if (!retweetsRes.ok) return false;

      const retweets = await retweetsRes.json();
      const isRetweeted = retweets.data?.some(
        (u: any) => u.id === targetUserId
      );

      return isRetweeted || false;
    }

    console.log("[VERIFY] X: Follow verification needs paid API");
    return false;

  } catch (err) {
    console.error("[VERIFY] X error:", err);
    return false;
  }
};

// ─── Telegram Verification ──────────────────────────────────────────────────

const verifyTelegramTask = async (task: Task, proof: any): Promise<boolean> => {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_GROUP_ID) {
    console.warn("[VERIFY] TELEGRAM_BOT_TOKEN or TELEGRAM_GROUP_ID not set");
    return false;
  }

  const telegramId = proof?.telegramId;

  if (!telegramId) {
    console.log("[VERIFY] Telegram: no telegramId provided");
    return false;
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChatMember?` +
      `chat_id=${TELEGRAM_GROUP_ID}&user_id=${telegramId}`
    );

    const data = await res.json();

    if (!data.ok) {
      console.log("[VERIFY] Telegram: API error", data.description);
      return false;
    }

    const status = data.result?.status;
    const isMember = ['member', 'administrator', 'creator'].includes(status);

    console.log(`[VERIFY] Telegram: user status = ${status}, isMember = ${isMember}`);
    
    return isMember;

  } catch (err) {
    console.error("[VERIFY] Telegram error:", err);
    return false;
  }
};

// ─── YouTube Verification ────────────────────────────────────────────────────

const verifyYouTubeTask = async (task: Task, proof: any): Promise<boolean> => {
  if (!YOUTUBE_API_KEY || !YOUTUBE_CHANNEL_ID) {
    console.warn("[VERIFY] YOUTUBE_API_KEY or YOUTUBE_CHANNEL_ID not set");
    return false;
  }

  // ✅ FIX: تحقق من وجود URL
  if (!task.url) {
    console.log("[VERIFY] YouTube: task has no URL");
    return false;
  }

  console.log("[VERIFY] YouTube: needs OAuth 2.0 consent");
  
  const videoId = extractVideoId(task.url); // ✅ الآن task.url مضمون string

  if (!videoId) {
    console.log("[VERIFY] YouTube: invalid video URL");
    return false;
  }

  try {
    const commentsRes = await fetch(
      `https://www.googleapis.com/youtube/v3/commentThreads?` +
      `part=snippet&videoId=${videoId}&key=${YOUTUBE_API_KEY}&maxResults=100`
    );

    if (!commentsRes.ok) return false;

    const comments = await commentsRes.json();
    
    return false; // TODO: قارن بـ channelId للمستخدم

  } catch (err) {
    console.error("[VERIFY] YouTube error:", err);
    return false;
  }
};

// ─── Article Verification ────────────────────────────────────────────────────

const verifyArticleTask = async (task: Task, proof: any): Promise<boolean> => {
  if (proof?.timeSpent && proof.timeSpent >= 30) {
    console.log(`[VERIFY] Article: timeSpent = ${proof.timeSpent}s`);
    return true;
  }

  console.log("[VERIFY] Article: needs manual review or time tracking");
  return false;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractTweetId(url: string): string | null {
  const match = url.match(/status\/(\d+)/);
  return match ? match[1] : null;
}

function extractVideoId(url: string): string | null {
  const match = url.match(/[?&]v=([^&]+)/) || url.match(/youtu\.be\/([^?]+)/);
  return match ? match[1] : null;
}
