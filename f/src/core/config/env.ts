import "dotenv/config";

import { SEPOLIA_CHAIN_ID } from "@core/blockchain/chains/constants";
import { parseOriginList } from "@core/security/origin";

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

/**
 * Optional positive integer. Returns null when unset/invalid so the
 * caller can distinguish "not configured" from a real block number
 * (block 0 is never a valid contract deployment block).
 */
const optionalBlockNumber = (value: string | undefined): number | null => {
  if (!value) return null;
  const n = Number(value.trim());
  return Number.isInteger(n) && n > 0 ? n : null;
};

const clampNumber = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const optionalBool = (value: string | undefined, fallback = false): boolean =>
  value ? value === "true" : fallback;

// ─── Network Guard ────────────────────────────────────────────────────────

/**
 * Infolast is a Sepolia-Testnet-only project. A non-Sepolia CHAIN_ID
 * (e.g. 1 = mainnet) would silently write mainnet data into the testnet
 * tracking tables, so we fail fast at startup instead.
 */
const resolveChainId = (value: string | undefined): number => {
  const chainId = optionalNumber(value, SEPOLIA_CHAIN_ID);

  if (chainId !== SEPOLIA_CHAIN_ID) {
    throw new Error(
      `Invalid CHAIN_ID: ${chainId}. Infolast is configured for Ethereum Sepolia Testnet only ` +
        `(CHAIN_ID=${SEPOLIA_CHAIN_ID}, hex 0xaa36a7).`
    );
  }

  return chainId;
};

// ─── Env ──────────────────────────────────────────────────────────────────

export const env = {

  // ── App ───────────────────────────────────────────────────────────────
  nodeEnv:      optional(process.env.NODE_ENV, "development"),
  port:         optionalNumber(process.env.PORT, 3000),
  appUrl:       optional(process.env.APP_URL, "APP_URL"),
  isProduction: process.env.NODE_ENV === "production",

  // ── Database ──────────────────────────────────────────────────────────
  databaseUrl: required(process.env.DATABASE_URL, "DATABASE_URL"),

  // ── Redis ─────────────────────────────────────────────────────────────
  redisUrl: required(process.env.REDIS_URL, "REDIS_URL"),

  // ── Security ──────────────────────────────────────────────────────────
  adminSecret: required(process.env.ADMIN_SECRET, "ADMIN_SECRET"),
  appSecret:   optional(process.env.APP_SECRET, ""),

  // ── CORS ──────────────────────────────────────────────────────────────
  // Comma-separated allowlist. "*" (or unset) means "reflect any origin".
  // Origins are normalized (trim + no trailing slash + lowercase) so a
  // value like "https://app.netlify.app/" still matches the browser's
  // "https://app.netlify.app" Origin header.
  corsOrigin: parseOriginList(process.env.CORS_ORIGIN),

  // ── Blockchain ────────────────────────────────────────────────────────
  rpcUrl:     required(process.env.RPC_URL, "RPC_URL"),
  chainId:    resolveChainId(process.env.CHAIN_ID),
  privateKey: process.env.PRIVATE_KEY, // اختياري: فقط للعمليات الكتابية

  // ── Contracts ─────────────────────────────────────────────────────────
  contracts: {
    airdrop:     required(process.env.AIRDROP_ADDRESS, "AIRDROP_ADDRESS"),
    token:       required(process.env.TOKEN_ADDRESS, "TOKEN_ADDRESS"),
    vesting:     process.env.VESTING_ADDRESS,       // اختياري (مستبعد)
    // يقبل الاسمين: PRICE_ORACLE_ADDRESS (الأساسي) و PRICEORACLE_ADDRESS (القديم)
    priceOracle:
      process.env.PRICE_ORACLE_ADDRESS ?? process.env.PRICEORACLE_ADDRESS, // اختياري (مستبعد)
    sale:        process.env.SALE_ADDRESS,          // اختياري (مستبعد)
  },

  // ── Blockchain Event Sync (Purchase / Vesting indexers) ───────────────
  sync: {
    /**
     * Contract deployment blocks. When set, the first sync starts here
     * (full history). When unset, the first run only indexes the most
     * recent SYNC_SAFE_LOOKBACK_BLOCKS blocks and logs a history gap.
     */
    saleStartBlock:    optionalBlockNumber(process.env.SALE_START_BLOCK),
    vestingStartBlock: optionalBlockNumber(process.env.VESTING_START_BLOCK),

    /** Max blocks per eth_getLogs request (auto-halved if provider rejects it) */
    batchSize: clampNumber(
      optionalNumber(process.env.SYNC_LOG_BATCH_SIZE, 2_000),
      1,
      100_000
    ),

    /**
     * How far behind the head we may query logs on a provider without
     * archive access. Measured on Chainstack Sepolia free plan: ~111 blocks.
     * Kept slightly lower as a safety margin.
     */
    safeLookbackBlocks: clampNumber(
      optionalNumber(process.env.SYNC_SAFE_LOOKBACK_BLOCKS, 100),
      1,
      1_000_000
    ),

    /** Retry attempts for transient RPC failures (not for plan limits) */
    maxRetries: clampNumber(
      optionalNumber(process.env.SYNC_MAX_RETRIES, 4),
      1,
      10
    ),

    /** Base delay for exponential backoff */
    retryBaseDelayMs: clampNumber(
      optionalNumber(process.env.SYNC_RETRY_BASE_DELAY_MS, 1_000),
      50,
      60_000
    ),

    /** Delay between successful batches (provider rate-limit courtesy) */
    batchDelayMs: clampNumber(
      optionalNumber(process.env.SYNC_BATCH_DELAY_MS, 250),
      0,
      60_000
    ),
  },

  // ── Airdrop / Merkle ──────────────────────────────────────────────────
  airdrop: {
    claimStart:  optionalNumber(process.env.CLAIM_START, 0), 
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
    botToken:      process.env.TELEGRAM_BOT_TOKEN,
    botUsername:   process.env.TELEGRAM_BOT_USERNAME,
    groupId:       process.env.TELEGRAM_GROUP_ID,
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET,
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
