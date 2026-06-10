// src/core/cache/stores/idempotency-cache.ts

import { cacheService } from "../cache.service";
import { CACHE_KEYS } from "../cache.keys";
import { CACHE_TTL } from "../cache-ttl";

export const idempotencyCache = {
  async exists(
    key: string
  ): Promise<boolean> {
    return cacheService.exists(
      CACHE_KEYS.idempotency(key)
    );
  },

  async mark(
    key: string
  ): Promise<void> {
    await cacheService.set(
      CACHE_KEYS.idempotency(key),
      true,
      CACHE_TTL.idempotency
    );
  },

  async clear(
    key: string
  ): Promise<void> {
    await cacheService.del(
      CACHE_KEYS.idempotency(key)
    );
  },
};