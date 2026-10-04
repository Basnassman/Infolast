import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { FakeCache } from "./test-helper";
import { accountLinkingService } from "../services/account-linking.service";
import { verificationTokenService } from "../services/verification.token.service";
import { VerificationPlatform } from "@prisma/client";

/**
 * Account Linking tests (I.1 + I.11 + duplicate linking).
 *
 * Flow under test:
 *   generateDeepLink(wallet) → token bound to REAL User.id
 *   → bot consumes token with telegramUserId
 *   → linkAccount(User.id, platform, telegramUserId)
 */
describe("Account Linking Service", () => {
  const wallet = "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12";
  const realUserId = "user-1"; // what resolveUser returns for the wallet

  let fakeCache: FakeCache;
  let linkCalls: any[];
  let linkedAccounts: any[];

  let originals: Record<string, any>;

  beforeEach(() => {
    fakeCache = new FakeCache();
    linkCalls = [];
    linkedAccounts = [];

    originals = {
      cacheService: (verificationTokenService as any).cacheService,
      resolveUser: (accountLinkingService as any).resolveUser,
      platformAccountRepository: (accountLinkingService as any).platformAccountRepository,
      verificationTokenService: (accountLinkingService as any).verificationTokenService,
    };

    (verificationTokenService as any).cacheService = fakeCache;

    // The wallet resolves to a real User row (User.id is a cuid, NOT the wallet)
    (accountLinkingService as any).resolveUser = async (w: string) => ({
      id: realUserId,
      walletAddress: w.toLowerCase(),
    });

    (accountLinkingService as any).verificationTokenService = verificationTokenService;

    (accountLinkingService as any).platformAccountRepository = {
      findByUserAndPlatform: async (userId: string) =>
        linkedAccounts.find((a) => a.userId === userId && a.platform === VerificationPlatform.TELEGRAM) ?? null,
      findByPlatformUserId: async (platform: VerificationPlatform, platformUserId: string) =>
        linkedAccounts.find((a) => a.platform === platform && a.platformUserId === platformUserId) ?? null,
      /**
       * Models Prisma `upsert` INCLUDING both database-level unique
       * constraints: @@unique([userId, platform]) and
       * @@unique([platform, platformUserId]).
       *
       * The ownership check and the write run in ONE synchronous block (no
       * awaits) — mirroring how a database applies a unique constraint
       * atomically. This is the layer the TOCTOU race test exercises: the
       * find-guard above can be raced, this cannot.
       */
      link: async (input: any) => {
        const uniqueViolation = () =>
          Object.assign(new Error("Unique constraint failed on platform, platformUserId"), {
            code: "P2002",
            meta: { target: ["platform", "platformUserId"] },
          });

        const byUserPlatform = linkedAccounts.find(
          (a) => a.userId === input.userId && a.platform === input.platform
        );

        if (!byUserPlatform) {
          const owner = linkedAccounts.find(
            (a) => a.platform === input.platform && a.platformUserId === input.platformUserId
          );
          if (owner) throw uniqueViolation(); // INSERT path → global identity uniqueness
          linkedAccounts.push({ ...input });
        } else {
          const owner = linkedAccounts.find(
            (a) =>
              a.platform === input.platform &&
              a.platformUserId === input.platformUserId &&
              a.userId !== input.userId
          );
          if (owner) throw uniqueViolation(); // UPDATE path → same global uniqueness
          Object.assign(byUserPlatform, input);
        }

        linkCalls.push(input);
        return input;
      },
      findByUser: async () => linkedAccounts,
      unlink: async () => undefined,
    };
  });

  afterEach(() => {
    (verificationTokenService as any).cacheService = originals.cacheService;
    Object.assign(accountLinkingService as any, {
      resolveUser: originals.resolveUser,
      platformAccountRepository: originals.platformAccountRepository,
      verificationTokenService: originals.verificationTokenService,
    });
    fakeCache.clear();
  });

  it("generateDeepLink binds the token to the REAL User.id, never the wallet address (I.1)", async () => {
    const { token, deepLinkUrl, expiresAt } = await accountLinkingService.generateDeepLink(
      wallet,
      VerificationPlatform.TELEGRAM
    );

    const stored = await fakeCache.get<any>(`verification:token:${token}`);
    assert.ok(stored, "token must be stored");
    assert.equal(stored.userId, realUserId, "token must be bound to User.id");
    assert.notEqual(stored.userId, wallet, "wallet address must never be used as User.id");
    assert.ok(!("walletAddress" in stored), "wallet address must not be stored in the token");
    assert.ok(deepLinkUrl.includes(token), "deep link URL must contain the token");
    assert.ok(expiresAt.getTime() > Date.now(), "token must not be pre-expired");
  });

  it("User A + Wallet A + Telegram A → Telegram A linked to User A (full consume→link flow)", async () => {
    const { token } = await accountLinkingService.generateDeepLink(
      wallet,
      VerificationPlatform.TELEGRAM
    );

    // Read-only validation first (webhook does this too)
    const validation = await accountLinkingService.validateDeepLinkToken(token);
    assert.equal(validation.valid, true);

    // Atomic consume with the Telegram identity (telegramUserId, not username)
    const consumed = await verificationTokenService.consume(token, {
      userId: validation.data!.userId,
      platform: VerificationPlatform.TELEGRAM,
      telegramUserId: "999888",
      telegramUsername: "telegramA",
    });
    assert.equal(consumed.success, true);

    const result = await accountLinkingService.linkAccount(
      consumed.success ? consumed.data.userId : "",
      VerificationPlatform.TELEGRAM,
      "999888",
      "telegramA"
    );

    assert.equal(result.success, true);
    assert.equal(linkCalls.length, 1);
    assert.equal(linkCalls[0].userId, realUserId, "PlatformAccount must be keyed by User.id (I.1)");
    assert.notEqual(linkCalls[0].userId, wallet, "wallet address must never be written as userId");
    assert.equal(linkCalls[0].platformUserId, "999888", "identity is telegramUserId (numeric id)");
  });

  it("same Telegram identity cannot be linked to a DIFFERENT user (duplicate linking guard)", async () => {
    // Telegram 999888 already belongs to user-OTHER
    linkedAccounts.push({
      userId: "user-OTHER",
      platform: VerificationPlatform.TELEGRAM,
      platformUserId: "999888",
    });

    const result = await accountLinkingService.linkAccount(
      realUserId,
      VerificationPlatform.TELEGRAM,
      "999888",
      "telegramA"
    );

    assert.equal(result.success, false, "must reject linking a Telegram account owned by another user");
    assert.match(String(result.error), /already linked/i);
    assert.equal(linkCalls.length, 0, "nothing may be written");
  });

  it("re-linking the same user's own Telegram identity is allowed", async () => {
    linkedAccounts.push({
      userId: realUserId,
      platform: VerificationPlatform.TELEGRAM,
      platformUserId: "999888",
    });

    const result = await accountLinkingService.linkAccount(
      realUserId,
      VerificationPlatform.TELEGRAM,
      "999888",
      "telegramA"
    );

    assert.equal(result.success, true);
    assert.equal(linkCalls.length, 1);
  });

  it("validateDeepLinkToken is read-only: it never consumes the token (I.2)", async () => {
    const { token } = await accountLinkingService.generateDeepLink(
      wallet,
      VerificationPlatform.TELEGRAM
    );

    const validation = await accountLinkingService.validateDeepLinkToken(token);
    assert.equal(validation.valid, true);

    const stillThere = await fakeCache.get<any>(`verification:token:${token}`);
    assert.ok(stillThere, "read-only validation must not consume the token");
  });

  it("User B cannot consume User A's token (session ownership, I.1/I.2)", async () => {
    const { token } = await accountLinkingService.generateDeepLink(
      wallet,
      VerificationPlatform.TELEGRAM
    );

    try {
      await verificationTokenService.consume(token, {
        userId: "user-B", // different user
        platform: VerificationPlatform.TELEGRAM,
        telegramUserId: "555444",
        telegramUsername: "userB",
      });
      assert.fail("expected DeepLinkTokenUserMismatchError");
    } catch (err: any) {
      assert.match(err.message, /different user/i);
    }
  });

  // ─── Phase 2.2 — (platform, platformUserId) uniqueness ───────────────────

  const rowsFor = (platformUserId: string) =>
    linkedAccounts.filter(
      (a) =>
        a.platform === VerificationPlatform.TELEGRAM &&
        a.platformUserId === platformUserId
    );

  it("NORMAL: User A + Telegram X → SUCCESS (exactly one row)", async () => {
    const result = await accountLinkingService.linkAccount(
      "user-A",
      VerificationPlatform.TELEGRAM,
      "777000",
      "x"
    );

    assert.equal(result.success, true);
    assert.equal(rowsFor("777000").length, 1);
    assert.equal(rowsFor("777000")[0].userId, "user-A");
  });

  it("DUPLICATE same user: User A + Telegram X again → no duplicate row (idempotent upsert)", async () => {
    const first = await accountLinkingService.linkAccount(
      "user-A",
      VerificationPlatform.TELEGRAM,
      "777000",
      "x"
    );
    const again = await accountLinkingService.linkAccount(
      "user-A",
      VerificationPlatform.TELEGRAM,
      "777000",
      "x"
    );

    assert.equal(first.success, true);
    assert.equal(again.success, true, "same-user re-link stays allowed (existing semantics, §5)");
    assert.equal(
      rowsFor("777000").length,
      1,
      "repeating the link must never create a second PlatformAccount row"
    );
    assert.equal(rowsFor("777000")[0].userId, "user-A");
  });

  it("DIFFERENT user: User A owns Telegram X → User B REJECTED by the application guard", async () => {
    const first = await accountLinkingService.linkAccount(
      "user-A",
      VerificationPlatform.TELEGRAM,
      "777000",
      "x"
    );
    const second = await accountLinkingService.linkAccount(
      "user-B",
      VerificationPlatform.TELEGRAM,
      "777000",
      "x"
    );

    assert.equal(first.success, true);
    assert.equal(second.success, false, "another user must never take over Telegram X");
    assert.match(String(second.error), /already linked/i);
    assert.equal(linkCalls.length, 1, "guard must reject before any write");
    assert.equal(rowsFor("777000").length, 1, "still exactly one owner");
    assert.equal(rowsFor("777000")[0].userId, "user-A", "no reassignment of identity");
  });

  it("CONCURRENT RACE: Promise.all(link(UserA, X), link(UserB, X)) → exactly 1 SUCCESS + 1 FAILURE", async () => {
    // Both requests pass the application find-guard (TOCTOU window), then
    // race the database-level unique constraint — only one INSERT can win.
    const results = await Promise.all([
      accountLinkingService.linkAccount("user-A", VerificationPlatform.TELEGRAM, "777000", "x"),
      accountLinkingService.linkAccount("user-B", VerificationPlatform.TELEGRAM, "777000", "x"),
    ]);

    const successes = results.filter((r) => r && r.success === true);
    const failures = results.filter((r) => !r || r.success !== true);

    assert.equal(successes.length, 1, "exactly one request must win the race");
    assert.equal(failures.length, 1, "exactly one request must lose");

    // The loser gets the typed application-level friendly error — never a
    // raw Prisma/database error.
    assert.match(String(failures[0].error), /already linked/i);
    assert.doesNotMatch(String(failures[0].error), /P2002|Unique constraint|prisma/i);

    // Database invariant: Telegram X → exactly one PlatformAccount owner.
    const owners = rowsFor("777000");
    assert.equal(owners.length, 1, "exactly one PlatformAccount must exist for Telegram X");
    assert.ok(
      owners[0].userId === "user-A" || owners[0].userId === "user-B",
      "the winner owns the identity"
    );
  });
});
