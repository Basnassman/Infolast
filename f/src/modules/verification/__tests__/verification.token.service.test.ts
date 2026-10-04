import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { FakeCache } from "./test-helper";
import { verificationTokenService } from "../services/verification.token.service";
import {
  DeepLinkTokenAlreadyUsedError,
  TelegramIdentityMismatch,
  DeepLinkTokenUserMismatchError,
} from "../errors/verification.errors";
import { VerificationPlatform } from "@prisma/client";

/**
 * The token service reads its cache through the `cacheService` property,
 * so each test swaps it for an in-memory fake (no Redis).
 */
let fakeCache: FakeCache;
let originalCacheService: any;

beforeEach(() => {
  fakeCache = new FakeCache();
  originalCacheService = (verificationTokenService as any).cacheService;
  (verificationTokenService as any).cacheService = fakeCache;
});

afterEach(() => {
  (verificationTokenService as any).cacheService = originalCacheService;
  fakeCache.clear();
});

describe("Verification Token Service", () => {
  const userId = "user-1";

  it("generates a token bound to a real User.id, NOT walletAddress (I.1)", async () => {
    const { token, expiresAt } = await verificationTokenService.generate(userId, VerificationPlatform.TELEGRAM);

    const stored = await fakeCache.get<any>(`verification:token:${token}`);
    assert.ok(stored, "token should be stored in cache");
    assert.equal(stored.userId, userId, "token must be bound to the real User.id");
    // The raw wallet address must never be stored in the token record
    assert.ok(!stored.hasOwnProperty("walletAddress"), "walletAddress must not be stored in token record");
    assert.equal(stored.platform, VerificationPlatform.TELEGRAM);
    assert.ok(
      stored.expiresAt !== null && stored.expiresAt > Date.now(),
      "token must have a short TTL (600s)"
    );
    assert.ok(
      Math.abs(expiresAt.getTime() - stored.expiresAt) < 2000,
      "returned expiresAt must match the stored record"
    );
    assert.ok(token.length >= 40, "token should be sufficiently random and non-guessable");
  });

  it("single-use: first consume succeeds, second consume fails (I.2)", async () => {
    const { token } = await verificationTokenService.generate(userId, VerificationPlatform.TELEGRAM);

    const context = {
      userId,
      platform: VerificationPlatform.TELEGRAM,
      telegramUserId: "123456",
      telegramUsername: "testuser",
    };

    // First consume succeeds
    const first = await verificationTokenService.consume(token, context);
    assert.equal(first.success, true, "first consume should succeed");

    // Second consume must fail (typed replay error)
    try {
      await verificationTokenService.consume(token, context);
      assert.fail("expected consume to throw for reused token");
    } catch (err: any) {
      assert.ok(err instanceof DeepLinkTokenAlreadyUsedError, "should throw DeepLinkTokenAlreadyUsedError");
      assert.match(err.message, /already used/i);
    }

    // The token record is gone after consumption
    const stillPresent = await fakeCache.get<any>(`verification:token:${token}`);
    assert.equal(stillPresent, null, "token record should be deleted after consumption");
  });

  it("replay protection: concurrent consumes return FAILURE for all but one", async () => {
    const { token } = await verificationTokenService.generate(userId, VerificationPlatform.TELEGRAM);

    const context = {
      userId,
      platform: VerificationPlatform.TELEGRAM,
      telegramUserId: "123456",
      telegramUsername: "testuser",
    };

    const results = await Promise.all([
      verificationTokenService.consume(token, context),
      verificationTokenService.consume(token, context),
    ]);

    // Exactly one succeeds, the other fails — never two links.
    const successes = results.filter((r) => r && r.success === true);
    assert.equal(successes.length, 1, "only one of the concurrent consumes should succeed");
    const failures = results.filter((r) => r && r.success !== true);
    assert.ok(failures.length >= 1, "at least one should fail");
  });

  it("expired: token past TTL is rejected", async () => {
    const { token } = await verificationTokenService.generate(userId, VerificationPlatform.TELEGRAM);

    // Inject an already-expired token directly into the fake cache
    await fakeCache.set(`verification:token:${token}`, {
      userId,
      platform: VerificationPlatform.TELEGRAM,
      telegramUserId: "123456",
      telegramUsername: "testuser",
      createdAt: Date.now() - 100000,
      expiresAt: Date.now() - 100, // already expired
    } as any, 600);

    const result = await verificationTokenService.validate(token);
    assert.equal(result.valid, false, "expired token should be invalid");
    assert.match(String(result.error), /expired/i);
  });

  it("identity mismatch: token bound to telegramUserId A cannot link telegramUserId B (I.11)", async () => {
    const { token } = await verificationTokenService.generate(userId, VerificationPlatform.TELEGRAM);

    // Consume token as Telegram user "111111"
    const contextA = {
      userId,
      platform: VerificationPlatform.TELEGRAM,
      telegramUserId: "111111",
      telegramUsername: "userA",
    };
    const first = await verificationTokenService.consume(token, contextA);
    assert.equal(first.success, true);

    // Now try to consume the same token as Telegram user "222222"
    const contextB = {
      userId,
      platform: VerificationPlatform.TELEGRAM,
      telegramUserId: "222222",
      telegramUsername: "userB",
    };

    try {
      await verificationTokenService.consume(token, contextB);
      assert.fail("expected TelegramIdentityMismatch");
    } catch (err: any) {
      assert.ok(err instanceof TelegramIdentityMismatch, "should throw TelegramIdentityMismatch");
      assert.match(err.message, /identity mismatch/i);
    }
  });

  it("user mismatch: token bound to user A cannot be consumed by user B", async () => {
    const { token } = await verificationTokenService.generate(userId, VerificationPlatform.TELEGRAM);

    const context = {
      userId: "user-999", // different user
      platform: VerificationPlatform.TELEGRAM,
      telegramUserId: "123456",
      telegramUsername: "testuser",
    };

    try {
      await verificationTokenService.consume(token, context);
      assert.fail("expected DeepLinkTokenUserMismatchError");
    } catch (err: any) {
      assert.ok(err instanceof DeepLinkTokenUserMismatchError, "should throw DeepLinkTokenUserMismatchError");
      assert.match(err.message, /different user/i);
    }
  });

  it("validate() does NOT consume the token (I.2)", async () => {
    const { token } = await verificationTokenService.generate(userId, VerificationPlatform.TELEGRAM);

    const validation = await verificationTokenService.validate(token);
    assert.equal(validation.valid, true);

    // Token should still be present after read-only validation
    const stillPresent = await fakeCache.get<any>(`verification:token:${token}`);
    assert.ok(stillPresent, "token should still exist after validate()");
  });

  it("validate() rejects unknown token", async () => {
    const result = await verificationTokenService.validate("unknown-token");
    assert.equal(result.valid, false);
    assert.match(String(result.error), /not found or expired/i);
  });
});
