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
        // بيانات تالفة في الـ cache - نتجاهلها ونرجع null
        return null;
      }
    } catch (error) {
      // Redis غير متاح - نتجاهل الـ cache ونكمل من الـ DB
      logger.error({ key, err: error }, "[Cache] get failed, bypassing cache");
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
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const value = await callback();
    await this.set(key, value, ttlSeconds); // لن يرمي خطأ حتى لو Redis فشل
    return value;
  },
};