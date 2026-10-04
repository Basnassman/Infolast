import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { FakeTelegramClient, FakeCache } from "./test-helper";
import { TelegramProvider } from "../providers/telegram/telegram.provider";
import { VerificationPlatform } from "@prisma/client";

// Cast `verify` so tests can pass an optional channelIdentifier
// without a type error.
type VerifyFn = (context: any, canUseCache?: boolean) => Promise<any>;
const verifyFn = TelegramProvider.prototype.verify as VerifyFn;

const baseContext = (overrides: any = {}) => ({
  userId: "user-1",
  taskId: "task-1",
  platform: VerificationPlatform.TELEGRAM,
  channelIdentifier: "chat-1",
  metadata: { platformUserId: "123456", platformUsername: "testuser" },
  ...overrides,
});

describe("Telegram Provider", () => {
  let provider: TelegramProvider;
  let fakeTelegram: FakeTelegramClient;
  let fakeCache: FakeCache;
  let originalClient: any;
  let originalCache: any;

  beforeEach(() => {
    provider = new TelegramProvider();
    fakeTelegram = new FakeTelegramClient();
    fakeCache = new FakeCache();

    // Point the provider's injectable statics at our fakes
    originalClient = (TelegramProvider as any).telegramClient;
    originalCache = (TelegramProvider as any).cacheService;
    (TelegramProvider as any).telegramClient = fakeTelegram;
    (TelegramProvider as any).cacheService = fakeCache;
  });

  afterEach(() => {
    (TelegramProvider as any).telegramClient = originalClient;
    (TelegramProvider as any).cacheService = originalCache;
  });

  it("VERIFIED: member status returns isMember=true (I.6)", async () => {
    const result = await verifyFn.call(provider, baseContext(), true);

    assert.equal(result.isMember, true);
    assert.equal(result.status, "member");
    assert.equal(fakeTelegram.getChatMemberCalls.length, 1);
  });

  it("VERIFIED: administrator status is accepted as member (I.6)", async () => {
    fakeTelegram.chatMemberResponse = {
      ok: true,
      result: { status: "administrator", user: { id: 123456 } },
    };

    const result = await verifyFn.call(provider, baseContext(), true);

    assert.equal(result.isMember, true);
    assert.equal(result.status, "administrator");
  });

  it("VERIFIED: creator status is accepted as member when returned (I.6)", async () => {
    fakeTelegram.chatMemberResponse = {
      ok: true,
      result: { status: "creator", user: { id: 123456 } },
    } as any;

    const result = await verifyFn.call(provider, baseContext(), true);

    assert.equal(result.isMember, true);
    assert.equal(result.status, "creator");
  });

  it("NOT_VERIFIED: left status returns isMember=false (I.6)", async () => {
    fakeTelegram.chatMemberResponse = {
      ok: true,
      result: { status: "left", user: { id: 123456 } },
    };

    const result = await verifyFn.call(provider, baseContext(), true);

    assert.equal(result.isMember, false);
    assert.equal(result.status, "left");
  });

  it("NOT_VERIFIED: kicked status is rejected (I.6)", async () => {
    fakeTelegram.chatMemberResponse = {
      ok: true,
      result: { status: "kicked", user: { id: 123456 } },
    };

    const result = await verifyFn.call(provider, baseContext(), true);

    assert.equal(result.isMember, false);
  });

  it("live check (cache bypassed) ignores stale cache and queries Telegram (I.3/I.4)", async () => {
    // Pre-populate a STALE "member" cache entry under the real cache key
    await fakeCache.set("verification:TELEGRAM:chat-1:123456", {
      success: true,
      isMember: true,
      status: "member",
    } as any, 900);

    // Membership has since changed to "left"
    fakeTelegram.chatMemberResponse = {
      ok: true,
      result: { status: "left", user: { id: 123456 } },
    };

    const result = await verifyFn.call(provider, baseContext(), false /* canUseCache */);

    // Must reflect the LIVE state, NOT the stale cache
    assert.equal(result.isMember, false, "must NOT trust stale cache");
    assert.equal(result.status, "left");
    assert.equal(fakeTelegram.getChatMemberCalls.length, 1, "Telegram API must be called");
  });

  it("normal check may use the cache as an optimization (I.4)", async () => {
    await fakeCache.set("verification:TELEGRAM:chat-1:123456", {
      success: true,
      isMember: true,
      status: "member",
    } as any, 900);

    const result = await verifyFn.call(provider, baseContext(), true);

    assert.equal(result.isMember, true);
    assert.equal(fakeTelegram.getChatMemberCalls.length, 0, "cache hit must not call Telegram");
  });

  it("checkMembership always hits Telegram API, never cache", async () => {
    fakeTelegram.chatMemberResponse = {
      ok: true,
      result: { status: "member", user: { id: 123456 } },
    };

    const isMember = await provider.checkMembership("chat-1", "123456");
    assert.equal(isMember, true);
    assert.equal(fakeTelegram.getChatMemberCalls.length, 1);

    // A second call still queries the API (no cache)
    await provider.checkMembership("chat-1", "123456");
    assert.equal(fakeTelegram.getChatMemberCalls.length, 2, "checkMembership must never cache");
  });

  it("checkMembership with missing channel identifier fails closed", async () => {
    const isMember = await provider.checkMembership(undefined, "123456");
    assert.equal(isMember, false);
    assert.equal(fakeTelegram.getChatMemberCalls.length, 0);
  });

  it("returns failure when Telegram API errors", async () => {
    fakeTelegram.chatMemberResponse = {
      ok: false,
      description: "User not found",
    };

    const result = await verifyFn.call(provider, baseContext(), true);

    assert.equal(result.isMember, false);
    assert.match(String(result.error), /User not found/i);
  });

  it("returns failure when no channel identifier", async () => {
    const result = await verifyFn.call(
      provider,
      baseContext({ channelIdentifier: undefined }),
      true
    );

    assert.equal(result.isMember, false);
    assert.match(String(result.error), /channel identifier/i);
  });

  it("returns failure when Telegram account not linked", async () => {
    const result = await verifyFn.call(
      provider,
      baseContext({ metadata: { platformUserId: undefined, platformUsername: undefined } }),
      true
    );

    assert.equal(result.isMember, false);
    assert.match(String(result.error), /not linked/i);
  });
});
