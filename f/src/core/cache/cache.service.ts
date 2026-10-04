import { redis } from "./redis";
import { logger } from "@core/logger/logger";

import { CacheWriteError } from "@core/errors/infrastructure/cache/cache-write.error";
import { CacheDeleteError } from "@core/errors/infrastructure/cache/cache-delete.error";

export const cacheService = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await redis.get(key);
      if (!value) return null;
      try {
        return JSON.parse(value) as T;
      } catch {
        // corrupted cache data - ignore and return null
        return null;
      }
    } catch (error) {
      // Redis unavailable - bypass cache and continue from DB
      logger.error({ key, err: error }, "[Cache] get failed, bypassing cache");
      return null;
    }
  },

  /**
   * Atomic read-and-delete (Redis GETDEL semantics).
   *
   * Implemented as a single Lua EVAL so the read and the delete can never
   * be interleaved by another client — two concurrent callers can never
   * both obtain the value. Used by the deep-link token service for
   * single-use consumption (I.2).
   *
   * Returns the raw JSON string (or null) so callers can cast it.
   * On Redis failure returns null → callers fail closed.
   */
  async getAndDel(key: string): Promise<string | null> {
    try {
      const script =
        "local v = redis.call('GET', KEYS[1]); if v then redis.call('DEL', KEYS[1]) end; return v";
      const value = (await (redis as any).eval(script, 1, key)) as string | null;
      return typeof value === "string" ? value : null;
    } catch (error) {
      logger.error({ key, err: error }, "[Cache] getAndDel failed, bypassing cache");
      return null;
    }
  },

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await redis.set(key, serialized, "EX", ttlSeconds);
      } else {
        await redis.set(key, serialized);
      }
    } catch (error) {
      // فشل الكتابة في الـ cache ليس كارثياً
      logger.error({ key, err: error }, "[Cache] set failed");
      // لا نرمي خطأ - نكمل بدون cache
    }
  },

  async del(key: string): Promise<void> {
    try {
      await redis.del(key);
    } catch (error) {
      throw new CacheDeleteError(
        key,
        error instanceof Error ? error.message : undefined
      );
    }
  },

  async exists(key: string): Promise<boolean> {
    try {
      const exists = await redis.exists(key);
      return Boolean(exists);
    } catch (error) {
      return false; // عند الشك نعتبر الـ key غير موجود
    }
  },

  async remember<T>(key: string, ttlSeconds: number, callback: () => Promise<T>): Promise<T> {
    const cached = await this.get(key) as T | null;
    if (cached !== null) return cached;
    const value = await callback();
    await this.set(key, value, ttlSeconds); // لن يرمي خطأ حتى لو Redis فشل
    return value;
  },
};