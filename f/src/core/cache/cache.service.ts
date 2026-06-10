import { redis } from "./redis";

import { CacheReadError } from "@core/errors/infrastructure/cache/cache-read.error";
import { CacheWriteError } from "@core/errors/infrastructure/cache/cache-write.error";
import { CacheDeleteError } from "@core/errors/infrastructure/cache/cache-delete.error";
import { CacheParseError } from "@core/errors/infrastructure/cache/cache-parse.error";

export const cacheService = {
  async get<T>(
    key: string
  ): Promise<T | null> {
    let value: string | null;

    try {
      value = await redis.get(key);
    } catch (error) {
      throw new CacheReadError(
        key,
        error instanceof Error
          ? error.message
          : undefined
      );
    }

    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as T;
    } catch (error) {
      throw new CacheParseError(
        key,
        error instanceof Error
          ? error.message
          : undefined
      );
    }
  },

  async set(
    key: string,
    value: unknown,
    ttlSeconds?: number
  ): Promise<void> {
    try {
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
    } catch (error) {
      throw new CacheWriteError(
        key,
        error instanceof Error
          ? error.message
          : undefined
      );
    }
  },

  async del(
    key: string
  ): Promise<void> {
    try {
      await redis.del(key);
    } catch (error) {
      throw new CacheDeleteError(
        key,
        error instanceof Error
          ? error.message
          : undefined
      );
    }
  },

  async exists(
    key: string
  ): Promise<boolean> {
    try {
      const exists =
        await redis.exists(key);

      return Boolean(exists);
    } catch (error) {
      throw new CacheReadError(
        key,
        error instanceof Error
          ? error.message
          : undefined
      );
    }
  },

  async remember<T>(
    key: string,
    ttlSeconds: number,
    callback: () => Promise<T>
  ): Promise<T> {
    const cached =
      await this.get<T>(key);

    if (cached !== null) {
      return cached;
    }

    const value =
      await callback();

    await this.set(
      key,
      value,
      ttlSeconds
    );

    return value;
  },
};