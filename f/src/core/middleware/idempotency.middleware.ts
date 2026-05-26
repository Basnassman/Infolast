import {
  Request,
  Response,
  NextFunction,
} from "express";

import { redis } from "../cache/redis";

import { CACHE_KEYS } from "../cache/cache.keys";

import { CACHE_TTL } from "../cache/cache-ttl";

export const idempotencyMiddleware =
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const key =
      req.headers[
        "idempotency-key"
      ];

    if (
      !key ||
      typeof key !== "string"
    ) {
      return res.status(400).json({
        success: false,

        error: {
          code:
            "IDEMPOTENCY_KEY_REQUIRED",

          message:
            "Idempotency key is required",
        },
      });
    }

    const redisKey =
      CACHE_KEYS.idempotency(
        key
      );

    const exists =
      await redis.exists(
        redisKey
      );

    if (exists) {
      return res.status(409).json({
        success: false,

        error: {
          code:
            "DUPLICATE_REQUEST",

          message:
            "Duplicate request detected",
        },
      });
    }

    await redis.set(
      redisKey,
      "1",
      "EX",
      CACHE_TTL.idempotency
    );

    next();
  };