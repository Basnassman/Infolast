import { redis } from "@core/cache/redis";

export const distributedLockService =
  {
    async acquire(
      key: string,
      ttlSeconds: number
    ): Promise<boolean> {
      const result =
        await redis.set(
          key,
          "locked",
          "EX",
          ttlSeconds,
          "NX"
        );

      return result === "OK";
    },

    async release(
      key: string
    ): Promise<void> {
      await redis.del(key);
    },
  };