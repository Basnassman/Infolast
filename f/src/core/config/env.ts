import "dotenv/config";

const required = (
  value: string | undefined,
  key: string
): string => {
  if (!value) {
    throw new Error(
      `Missing environment variable: ${key}`
    );
  }

  return value;
};

export const env = {
  nodeEnv:
    process.env.NODE_ENV ||
    "development",

  redisUrl: required(
    process.env.REDIS_URL,
    "REDIS_URL"
  ),

  corsOrigin:
    process.env.CORS_ORIGIN ||
    true,

  port: Number(
    process.env.PORT || 3000
  ),

  appUrl:
    process.env.APP_URL ||
    "http://localhost:3000",

  databaseUrl: required(
    process.env.DATABASE_URL,
    "DATABASE_URL"
  ),

  rpcUrl: required(
    process.env.RPC_URL,
    "RPC_URL"
  ),

  chainId: Number(
    process.env.CHAIN_ID ||
      11155111
  ),

  privateKey:
    process.env.PRIVATE_KEY,

  contracts: {
    airdrop: required(
      process.env.AIRDROP_CONTRACT,
      "AIRDROP_CONTRACT"
    ),

    token: required(
      process.env.TOKEN_CONTRACT,
      "TOKEN_CONTRACT"
    ),

    vesting: required(
      process.env.VESTING_CONTRACT,
      "VESTING_CONTRACT"
    ),
  },

  telegram: {
    botToken:
      process.env.TELEGRAM_BOT_TOKEN,
  },

  rateLimit: {
    windowMs: Number(
      process.env.RATE_LIMIT_WINDOW ||
        60000
    ),

    maxRequests: Number(
      process.env.RATE_LIMIT_MAX ||
        100
    ),

    redisUrl: required(
  process.env.REDIS_URL,
  "REDIS_URL"
   ),
  },
} as const;