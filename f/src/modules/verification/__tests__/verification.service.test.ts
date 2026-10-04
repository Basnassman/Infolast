import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { FakeCache, FakeTelegramClient } from "./test-helper";
import { verificationService } from "../services/verification.service";
import { TelegramProvider } from "../providers/telegram/telegram.provider";
import { VerificationPlatform, VerificationStatus } from "@prisma/client";
import { RequiredVerificationMissingError } from "../errors/verification.errors";

describe("Verification Service", () => {
  let fakeCache: FakeCache;
  let fakeTelegram: FakeTelegramClient;

  // Mutable fixtures (each test may override them)
  let taskFixture: any;
  let uvtFixture: any;
  let accountFixture: any;

  // Original (real) dependencies — restored after each test
  let originals: Record<string, any>;

  beforeEach(() => {
    fakeCache = new FakeCache();
    fakeTelegram = new FakeTelegramClient();

    taskFixture = {
      id: "task-1",
      title: "Telegram Verify",
      platform: VerificationPlatform.TELEGRAM,
      isActive: true,
      channelIdentifier: "chat-1",
      channelUrl: null,
    };
    uvtFixture = {
      id: "uv-1",
      userId: "user-1",
      verificationTaskId: "task-1",
      status: VerificationStatus.PENDING,
      verifiedAt: null,
      lastCheckedAt: null,
    };
    accountFixture = {
      id: "acc-1",
      userId: "user-1",
      platform: VerificationPlatform.TELEGRAM,
      platformUserId: "123456",
      platformUsername: "testuser",
      verified: true,
    };

    originals = {
      verificationTaskRepository: (verificationService as any).verificationTaskRepository,
      userVerificationTaskRepository: (verificationService as any).userVerificationTaskRepository,
      platformAccountRepository: (verificationService as any).platformAccountRepository,
      verificationLogRepository: (verificationService as any).verificationLogRepository,
      providerFactory: (verificationService as any).providerFactory,
      cacheService: (verificationService as any).cacheService,
      telegramClient: (TelegramProvider as any).telegramClient,
      providerCache: (TelegramProvider as any).cacheService,
    };

    (verificationService as any).verificationTaskRepository = {
      findById: async (id: string) => (id === taskFixture.id ? taskFixture : null),
    };
    (verificationService as any).userVerificationTaskRepository = {
      findByUserAndTask: async () => uvtFixture,
      upsert: async () => ({ id: "uv-1", ...(uvtFixture ?? {}) }),
      update: async (id: string, data: any) => ({ id, ...(uvtFixture ?? {}), ...data }),
    };
    (verificationService as any).platformAccountRepository = {
      findByUserAndPlatform: async () => accountFixture,
    };
    (verificationService as any).verificationLogRepository = {
      create: async (entry: any) => entry,
    };
    (verificationService as any).providerFactory = {
      get: () => new TelegramProvider(),
    };
    (verificationService as any).cacheService = fakeCache;
    (TelegramProvider as any).telegramClient = fakeTelegram;
    (TelegramProvider as any).cacheService = fakeCache;
  });

  afterEach(() => {
    Object.assign(verificationService as any, {
      verificationTaskRepository: originals.verificationTaskRepository,
      userVerificationTaskRepository: originals.userVerificationTaskRepository,
      platformAccountRepository: originals.platformAccountRepository,
      verificationLogRepository: originals.verificationLogRepository,
      providerFactory: originals.providerFactory,
      cacheService: originals.cacheService,
    });
    (TelegramProvider as any).telegramClient = originals.telegramClient;
    (TelegramProvider as any).cacheService = originals.providerCache;
  });

  it("MISSING required verification record -> fails closed (I.5)", async () => {
    uvtFixture = null;

    try {
      await verificationService.verifyUserTask("user-1", "task-1");
      assert.fail("expected RequiredVerificationMissingError");
    } catch (err: any) {
      assert.ok(err instanceof RequiredVerificationMissingError, "should throw RequiredVerificationMissingError");
      assert.match(err.message, /missing required verification/i);
    }
  });

  it("first-time verify with an existing PENDING record runs a LIVE membership check", async () => {
    fakeTelegram.chatMemberResponse = {
      ok: true,
      result: { status: "left", user: { id: 123456 } },
    };

    const result = await verificationService.verifyUserTask("user-1", "task-1");

    // Not a member → NOT_VERIFIED (PENDING record must never become VERIFIED)
    assert.equal(result.status, VerificationStatus.REJECTED);
    assert.equal(fakeTelegram.getChatMemberCalls.length, 1, "Telegram API must be queried live");
  });

  it("re-verification ALWAYS live-checks Telegram (I.3) — membership lost → REVOKED (I.6)", async () => {
    uvtFixture = {
      id: "uv-1",
      userId: "user-1",
      verificationTaskId: "task-1",
      status: VerificationStatus.VERIFIED,
      verifiedAt: new Date().toISOString(),
      lastCheckedAt: new Date().toISOString(),
    };

    // Membership has changed to "left" since the last check
    fakeTelegram.chatMemberResponse = {
      ok: true,
      result: { status: "left", user: { id: 123456 } },
    };

    const result = await verificationService.reverificationCheck("user-1", "task-1");

    assert.equal(result.status, VerificationStatus.REVOKED, "previously VERIFIED + not member → REVOKED");
    assert.equal(result.changed, true, "state changed from VERIFIED to REVOKED");
    assert.equal(fakeTelegram.getChatMemberCalls.length, 1, "Telegram API must be called (no cache shortcut)");
  });

  it("re-verification: membership still valid → stays VERIFIED, changed=false", async () => {
    uvtFixture = {
      id: "uv-1",
      userId: "user-1",
      verificationTaskId: "task-1",
      status: VerificationStatus.VERIFIED,
      verifiedAt: new Date().toISOString(),
      lastCheckedAt: new Date().toISOString(),
    };

    fakeTelegram.chatMemberResponse = {
      ok: true,
      result: { status: "member", user: { id: 123456 } },
    };

    const result = await verificationService.reverificationCheck("user-1", "task-1");

    assert.equal(result.status, VerificationStatus.VERIFIED, "still VERIFIED");
    assert.equal(result.changed, false, "no state change → counters must not increment");
    assert.equal(fakeTelegram.getChatMemberCalls.length, 1, "Telegram API must be called (no cache shortcut)");
  });

  it("re-verification with a STALE cached VERIFIED still queries Telegram (I.4)", async () => {
    uvtFixture = {
      id: "uv-1",
      userId: "user-1",
      verificationTaskId: "task-1",
      status: VerificationStatus.VERIFIED,
      verifiedAt: new Date().toISOString(),
      lastCheckedAt: new Date().toISOString(),
    };

    // Stale cached "member" result — must NOT be used by reverification
    await fakeCache.set("verification:TELEGRAM:chat-1:123456", {
      success: true,
      isMember: true,
      status: "member",
    } as any, 900);

    fakeTelegram.chatMemberResponse = {
      ok: true,
      result: { status: "left", user: { id: 123456 } },
    };

    const result = await verificationService.reverificationCheck("user-1", "task-1");

    assert.equal(result.status, VerificationStatus.REVOKED, "cache must not hide the revoked state");
    assert.equal(fakeTelegram.getChatMemberCalls.length, 1, "live check must happen");
  });

  it("verifyUserTask honors canUseCache=false for live check (I.3/I.4)", async () => {
    // Pre-populate a STALE "member" cache entry under the real cache key
    await fakeCache.set("verification:TELEGRAM:chat-1:123456", {
      success: true,
      isMember: true,
      status: "member",
    } as any, 900);

    // Live: membership is now "left"
    fakeTelegram.chatMemberResponse = {
      ok: true,
      result: { status: "left", user: { id: 123456 } },
    };

    const result = await verificationService.verifyUserTask("user-1", "task-1", false);

    // Must reflect live state, not stale cache
    assert.equal(result.status, VerificationStatus.REJECTED);
    assert.equal(fakeTelegram.getChatMemberCalls.length, 1, "claim gate must query Telegram live");
  });

  it("claim gate on a previously VERIFIED record + lost membership → REVOKED (I.6)", async () => {
    uvtFixture = {
      id: "uv-1",
      userId: "user-1",
      verificationTaskId: "task-1",
      status: VerificationStatus.VERIFIED,
      verifiedAt: new Date().toISOString(),
      lastCheckedAt: new Date().toISOString(),
    };

    fakeTelegram.chatMemberResponse = {
      ok: true,
      result: { status: "left", user: { id: 123456 } },
    };

    const result = await verificationService.verifyUserTask("user-1", "task-1", false);
    assert.equal(result.status, VerificationStatus.REVOKED);
  });

  it("getVerificationStatus returns PENDING when record missing (never VERIFIED)", async () => {
    uvtFixture = null;
    const result = await verificationService.getVerificationStatus("user-999", "task-1");
    assert.equal(result.status, VerificationStatus.PENDING);
  });

  it("verifyUserTask returns REJECTED when task inactive (I.5/I.6)", async () => {
    taskFixture = { ...taskFixture, isActive: false };

    const result = await verificationService.verifyUserTask("user-1", "task-1");
    assert.equal(result.status, VerificationStatus.REJECTED);
    assert.equal(fakeTelegram.getChatMemberCalls.length, 0, "inactive task must not call Telegram");
  });
});
