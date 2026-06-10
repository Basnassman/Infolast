import { cacheService } from "../cache.service";
import { CACHE_KEYS } from "../cache.keys";
import { CACHE_TTL } from "../cache-ttl";

export const statsCache = {
  async get<T = unknown>(): Promise<T | null> {
    return cacheService.get<T>(
      CACHE_KEYS.stats()
    );
  },

  async set(
    data: unknown
  ): Promise<void> {
    await cacheService.set(
      CACHE_KEYS.stats(),
      data,
      CACHE_TTL.stats
    );
  },

  async delete(): Promise<void> {
    await cacheService.del(
      CACHE_KEYS.stats()
    );
  },

  async exists(): Promise<boolean> {
    return cacheService.exists(
      CACHE_KEYS.stats()
    );
  },
};