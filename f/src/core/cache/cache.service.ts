import { redis } from "../cache/redis";

export const cacheService = {
  async get<T>(
    key: string
  ): Promise<T | null> {
    const value =
      await redis.get(key);

    if (!value) {
      return null;
    }

    return JSON.parse(value);
  },

  async set(
    key: string,
    value: unknown,
    ttlSeconds?: number
  ): Promise<void> {
    const serialized =
      JSON.stringify(value);

    if (ttlSeconds) {
      await redis.set(
        key,
        serialized,
        "EX",
        ttlSeconds
      );

      return;
    }

    await redis.set(
      key,
      serialized
    );
  },

  async del(
    key: string
  ): Promise<void> {
    await redis.del(key);
  },

  async exists(
    key: string
  ): Promise<boolean> {
    const exists =
      await redis.exists(key);

    return exists === 1;
  },
};