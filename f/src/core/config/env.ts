import "dotenv/config";

// ─── Helpers ──────────────────────────────────────────────────────────────

const required = (value: string | undefined, key: string): string => {
  if (!value) throw new Error(`Missing required env variable: ${key}`);
  return value;
};

const optional = (value: string | undefined, fallback: string): string =>
  value ?? fallback;

const optionalNumber = (value: string | undefined, fallback: number): number => {
  const n = Number(value);
  return value && Number.isFinite(n) ? n : fallback;
};

const requiredNumber = (value: string | undefined, key: string): number => {
  const n = Number(value);
  if (!value || !Number.isFinite(n))
    throw new Error(`Missing or invalid required env variable: ${key}`);
  return n;
};

const optionalBool = (value: string | undefined, fallback = false): boolean =>
  value ? value === "true" : fallback;

// ─── Env ──────────────────────────────────────────────────────────────────

export const env = {

  // ── App ───────────────────────────────────────────────────────────────
  nodeEnv:      optional(process.env.NODE_ENV, "development"),
  port:         optionalNumber(process.env.PORT, 3000),
  appUrl:       optional(process.env.APP_URL, "http://localhost:3000"),
  isProduction: process.env.NODE_ENV === "production",

  // ── Database ──────────────────────────────────────────────────────────
  databaseUrl: required(process.env.DATABASE_URL, "DATABASE_URL"),

  // ── Redis ─────────────────────────────────────────────────────────────
  redisUrl: required(process.env.REDIS_URL, "REDIS_URL"),

  // ── Security ──────────────────────────────────────────────────────────
  adminSecret: required(process.env.ADMIN_SECRET, "ADMIN_SECRET"),
  appSecret:   optional(process.env.APP_SECRET, ""),

  // ── CORS ──────────────────────────────────────────────────────────────
  corsOrigin: (process.env.CORS_ORIGIN as string | boolean) ?? true,

  // ── Blockchain ────────────────────────────────────────────────────────
  rpcUrl:     required(process.env.RPC_URL, "RPC_URL"),
  chainId:    optionalNumber(process.env.CHAIN_ID, 11155111),
  privateKey: process.env.PRIVATE_KEY, // اختياري: فقط للعمليات الكتابية

  // ── Contracts ─────────────────────────────────────────────────────────
  contracts: {
    airdrop:     required(process.env.AIRDROP_ADDRESS, "AIRDROP_ADDRESS"),
    token:       required(process.env.TOKEN_ADDRESS, "TOKEN_ADDRESS"),
    vesting:     process.env.VESTING_ADDRESS,       // اختياري (مستبعد)
    priceOracle: process.env.PRICE_ORACLE_ADDRESS,  // اختياري (مستبعد)
    sale:        process.env.SALE_ADDRESS,          // اختياري (مستبعد)
  },

  // ── Airdrop / Merkle ──────────────────────────────────────────────────
  airdrop: {
    claimStart:  optionalNumber(process.env.CLAIM_START, 0), // 0 = وقت التشغيل
    claimEnd:    requiredNumber(process.env.CLAIM_END, "CLAIM_END"),
    claimCapWei: process.env.CLAIM_CAP_WEI, // اختياري: يُحسب من المخصصات
  },

  // ── Rate Limiting ─────────────────────────────────────────────────────
  rateLimit: {
    windowMs:    optionalNumber(process.env.RATE_LIMIT_WINDOW, 60_000),
    maxRequests: optionalNumber(process.env.RATE_LIMIT_MAX, 100),
  },

  // ── Telegram ──────────────────────────────────────────────────────────
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    groupId:  process.env.TELEGRAM_GROUP_ID,
  },

  // ── Task Verification APIs ────────────────────────────────────────────
  verification: {
    twitterBearerToken: process.env.TWITTER_BEARER_TOKEN,
    youtubeApiKey:      process.env.YOUTUBE_API_KEY,
    youtubeChannelId:   process.env.YOUTUBE_CHANNEL_ID,
  },

  // ── Feature Flags ─────────────────────────────────────────────────────
  features: {
    antiSybil:      optionalBool(process.env.ENABLE_SYBIL),
    emergencyPause: optionalBool(process.env.ENABLE_PAUSE),
  },

} as const;