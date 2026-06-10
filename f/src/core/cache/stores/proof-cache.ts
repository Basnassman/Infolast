import { cacheService } from "../cache.service";
import { CACHE_KEYS } from "../cache.keys";
import { CACHE_TTL } from "../cache-ttl";

export const proofCache = {
  async get<T = unknown>(
    walletAddress: string
  ): Promise<T | null> {
    return cacheService.get<T>(
      CACHE_KEYS.proof(walletAddress)
    );
  },

  async set(
    walletAddress: string,
    data: unknown
  ): Promise<void> {
    await cacheService.set(
      CACHE_KEYS.proof(walletAddress),
      data,
      CACHE_TTL.proof
    );
  },

  async delete(
    walletAddress: string
  ): Promise<void> {
    await cacheService.del(
      CACHE_KEYS.proof(walletAddress)
    );
  },

  async exists(
    walletAddress: string
  ): Promise<boolean> {
    return cacheService.exists(
      CACHE_KEYS.proof(walletAddress)
    );
  },
};