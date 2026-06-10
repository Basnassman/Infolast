import crypto from "crypto";

import { redis } from "@core/cache/redis";

import { LockHandle } from "./lock.types";

export const distributedLockService = {
  async acquire(
    key: string,
    ttlSeconds: number
  ): Promise<LockHandle | null> {
    const token =
      crypto.randomUUID();

    const result =
      await redis.set(
        key,
        token,
        "EX",
        ttlSeconds,
        "NX"
      );

    if (result !== "OK") {
      return null;
    }

    return {
      key,
      token,
    };
  },

  async release(
    lock: LockHandle
  ): Promise<boolean> {
    const currentToken =
      await redis.get(lock.key);

    if (
      currentToken !==
      lock.token
    ) {
      return false;
    }

    await redis.del(
      lock.key
    );

    return true;
  },

  async isLocked(
    key: string
  ): Promise<boolean> {
    return (
      (await redis.exists(key))
      === 1
    );
  },
};