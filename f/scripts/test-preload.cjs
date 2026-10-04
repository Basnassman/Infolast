#!/usr/bin/env node
/**
 * Test preload (loaded with `-r` in the CHILD test process).
 *
 * Must run BEFORE any TypeScript module is loaded, so that:
 * - `@core/cache/redis` / `ioredis` resolve to an in-memory fake (no Redis)
 * - `@core/telegram/telegram.client` resolves to a fake (no api.telegram.org)
 *
 * The test suite also injects FakeCache / FakeTelegramClient through the
 * module dependency properties — this preload is the safety net that makes
 * it impossible for a test to reach a real external service.
 */
const path = require("path");
const fs = require("fs");

const projectRoot = path.resolve(__dirname, "..");

// 1. In-memory fake Redis client.
//    `cacheService` already serialises values to JSON strings before calling
//    set/get, so the fake stores and returns the raw strings as-is.
const fakeRedis = {
  store: new Map(),

  get(key) {
    const v = this.store.get(key);
    return Promise.resolve(v !== undefined ? v : null);
  },

  set(key, value /*, mode, ttl */) {
    this.store.set(key, value);
    return Promise.resolve("OK");
  },

  del(key) {
    this.store.delete(key);
    return Promise.resolve(1);
  },

  exists(key) {
    return Promise.resolve(this.store.has(key));
  },

  getAndDel(key) {
    const v = this.store.get(key);
    this.store.delete(key);
    return Promise.resolve(v !== undefined ? v : null);
  },

  duplicate() {
    return { ...this };
  },
};

const patch = (absPath, exportsValue) => {
  if (!fs.existsSync(absPath)) return;
  require.cache[absPath] = {
    id: absPath,
    filename: absPath,
    loaded: true,
    exports: exportsValue,
  };
};

patch(path.resolve(projectRoot, "node_modules", "ioredis", "index.js"), fakeRedis);
patch(path.resolve(projectRoot, "src", "core", "cache", "redis.ts"), fakeRedis);

// 2. Fake Telegram client (Bot API) — a test can never hit the network.
patch(path.resolve(projectRoot, "src", "core", "telegram", "telegram.client.ts"), {
  getChatMember: async () => ({ ok: true, result: { status: "member", user: { id: 123456 } } }),
  getMe: async () => ({ ok: true, result: { id: 123456, username: "test", first_name: "test" } }),
  setWebhook: async () => ({ ok: true, description: undefined }),
  sendMessage: async () => ({ ok: true, result: {} }),
});
