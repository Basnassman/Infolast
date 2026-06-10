import { cacheService } from "../cache.service";

export const merkleCache = {
  async get<T = unknown>(
    key: string
  ): Promise<T | null> {
    return cacheService.get<T>(
      `merkle:${key}`
    );
  },

  async set(
    key: string,
    value: unknown,
    ttl?: number
  ): Promise<void> {
    await cacheService.set(
      `merkle:${key}`,
      value,
      ttl
    );
  },

  async delete(
    key: string
  ): Promise<void> {
    await cacheService.del(
      `merkle:${key}`
    );
  },
};