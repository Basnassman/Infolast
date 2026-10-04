/**
 * =====================================================
 * TEST HELPER — minimal fake objects for Telegram verification tests.
 * No external framework. Uses Node's built-in `node:test`.
 * =====================================================
 */

import { EventEmitter } from "events";

/**
 * Simple in-memory cache store with TTL support.
 * Mimics the shape used by `cacheService` in the verification module.
 */
export class FakeCache {
  protected store = new Map<string, { value: unknown; expiresAt: number | null }>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  /** Clear the store (public wrapper for tests). */
  clear(): void {
    this.store.clear();
  }

  /**
   * Atomic read-and-delete returning the RAW JSON string — mirrors
   * `cacheService.getAndDel` (Redis GETDEL) used by the token service.
   */
  async getAndDel(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    this.store.delete(key);
    return JSON.stringify(entry.value);
  }

  async getWithDel<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    this.store.delete(key);
    return entry.value as T;
  }
}

/**
 * Fake Telegram Bot API client. Records every `getChatMember` call.
 */
export class FakeTelegramClient extends EventEmitter {
  getChatMemberCalls: Array<{ chatId: string; userId: number }> = [];
  chatMemberResponse: { ok: boolean; result?: { status: string; user: { id: number } }; description?: string } = {
    ok: true,
    result: { status: "member", user: { id: 123456 } },
  };

  async getChatMember(chatId: string, userId: number) {
    this.getChatMemberCalls.push({ chatId, userId });
    return this.chatMemberResponse;
  }

  reset() {
    this.getChatMemberCalls = [];
    this.chatMemberResponse = {
      ok: true,
      result: { status: "member", user: { id: 123456 } },
    };
  }
}
