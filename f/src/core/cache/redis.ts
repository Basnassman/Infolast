import IORedis from "ioredis";

import { env } from "../config/env";
import { logger } from "@core/logger/logger";

export const redis =
  new IORedis(
    env.redisUrl,
    { maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: false,
    }
  );

redis.on(
  "connect",
  () => {
    logger.info("Redis connected");
  }
);

redis.on(
  "error",
  (error) => {
    logger.error({ err: error }, "Redis error");
  }
);