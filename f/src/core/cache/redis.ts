import IORedis from "ioredis";

import { env } from "../config/env";

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
    console.log(
      "✅ Redis connected"
    );
  }
);

redis.on(
  "error",
  (error) => {
    console.error(
      "❌ Redis error",
      error
    );
  }
);