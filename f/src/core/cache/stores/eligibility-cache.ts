import { cacheService } from "../cache.service";
import { CACHE_KEYS } from "../cache.keys";
import { CACHE_TTL } from "../cache-ttl";

export const eligibilityCache = {
  async get<T = unknown>(
    walletAddress: string
  ): Promise<T | null> {
    return cacheService.get<T>(
      CACHE_KEYS.eligibility(walletAddress)
    );
  },

  async set(
    walletAddress: string,
    data: unknown
  ): Promise<void> {
    await cacheService.set(
      CACHE_KEYS.eligibility(walletAddress),
      data,
      CACHE_TTL.eligibility
    );
  },

  async delete(
    walletAddress: string
  ): Promise<void> {
    await cacheService.del(
      CACHE_KEYS.eligibility(walletAddress)
    );
  },

  async exists(
    walletAddress: string
  ): Promise<boolean> {
    return cacheService.exists(
      CACHE_KEYS.eligibility(walletAddress)
    );
  },
};