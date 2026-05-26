import pino from "pino";

import { env } from "@core/config/env";

export const logger = pino({
  level:
    env.nodeEnv === "production"
      ? "info"
      : "debug",

  transport:
    env.nodeEnv !== "production"
      ? {
          target:
            "pino-pretty",

          options: {
            colorize: true,
          },
        }
      : undefined,

  base: {
    service:
      "airdrop-backend",
  },

  timestamp:
    pino.stdTimeFunctions.isoTime,
});