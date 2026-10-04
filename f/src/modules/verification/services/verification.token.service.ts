import crypto from "crypto";
import { VerificationPlatform } from "@prisma/client";
import { cacheService as coreCacheService } from "@core/cache/cache.service";
import { logger } from "@core/logger/logger";
import {
  DeepLinkTokenAlreadyUsedError,
  TelegramIdentityMismatch,
  DeepLinkTokenUserMismatchError,
} from "../errors/verification.errors";
import { VERIFICATION_CACHE_TTL } from "../types/verification.types";

/**
 * =====================================================
 * VERIFICATION TOKEN SERVICE
 * =====================================================
 *
 * Owns the full token lifecycle for platform account linking:
 *   CREATE → VALIDATE → ATOMIC CONSUME → LINK
 *
 * Token rules (Phase 2):
 * - cryptographically random (48 random bytes, base64url — not guessable)
 * - bound to a real User.id (NOT walletAddress)  (I.1)
 * - short TTL: 600 seconds
 * - single-use — consumption is atomic (GETDEL): a concurrent replay can
 *   never link twice  (I.2)
 * - identity bound to telegramUserId (not username)  (I.11)
 *
 * Storage (single source of truth — one key per token):
 * - `verification:token:<token>`       → VerificationTokenRecord
 *   (written by generate(), deleted atomically by consume() via getAndDel)
 * - `verification:token:meta:<token>`  → ConsumptionMeta
 *   (written by consume(); lets a replay be rejected with a precise reason:
 *    "already used" vs "identity mismatch")
 *
 * The cache is reachable through the `cacheService` property so tests can
 * swap it for an in-memory fake. Always call methods on the service object.
 */

const TOKEN_PREFIX = "verification:token";
const TOKEN_META_PREFIX = "verification:token:meta";
const TOKEN_TTL = VERIFICATION_CACHE_TTL.deepLinkToken; // 600 seconds

/**
 * Token record stored in the cache.
 * `userId` is the real Prisma User.id — a wallet address is never stored
 * here. `telegramUserId` is only present after the token has been consumed
 * once (bound at consume time by the bot webhook).
 */
export interface VerificationTokenRecord {
  userId: string;
  platform: VerificationPlatform;
  telegramUserId?: string;
  telegramUsername?: string;
  createdAt: number;
  expiresAt: number;
}

/**
 * Consumption metadata kept after a successful consume so that a replay can
 * be rejected with the correct typed error (single-use + identity binding).
 */
interface ConsumptionMeta {
  consumed: 1;
  telegramUserId?: string;
  consumedAt: number;
}

/**
 * Create a cryptographically random, non-guessable token.
 */
const createToken = (): string => crypto.randomBytes(48).toString("base64url");

const tokenKey = (token: string): string => `${TOKEN_PREFIX}:${token}`;

const tokenMetaKey = (token: string): string => `${TOKEN_META_PREFIX}:${token}`;

const redact = (token: string): string => token.substring(0, 8) + "...";

export const verificationTokenService = {
  /** Injectable cache (tests replace this with a fake). */
  cacheService: coreCacheService,

  /**
   * Generate a deep-link token bound to a real User.id.
   *
   * @param userId - The real User.id (NOT the wallet address).  (I.1)
   * @param platform - Verification platform.
   * @returns { token, expiresAt } — the caller builds the deep-link URL.
   */
  async generate(userId: string, platform: VerificationPlatform): Promise<{
    token: string;
    expiresAt: Date;
  }> {
    const token = createToken();

    const tokenData: VerificationTokenRecord = {
      userId,
      platform,
      createdAt: Date.now(),
      expiresAt: Date.now() + TOKEN_TTL * 1000,
    };

    await this.cacheService.set(tokenKey(token), tokenData, TOKEN_TTL);

    const expiresAt = new Date(tokenData.expiresAt);

    logger.info(
      { userId, platform, token: redact(token), expiresAt },
      "[VerificationToken] Token generated"
    );

    return { token, expiresAt };
  },

  /**
   * Read-only validation (does NOT consume the token).
   * Used by the Telegram bot webhook before consuming and by the frontend
   * to check a token's state.  (I.2: validate alone never links)
   */
  async validate(token: string): Promise<{
    valid: boolean;
    data?: VerificationTokenRecord;
    error?: string;
  }> {
    const data = await this.cacheService.get<VerificationTokenRecord>(tokenKey(token));

    if (!data) {
      return { valid: false, error: "Token not found or expired" };
    }

    if (Date.now() > data.expiresAt) {
      await this.cacheService.del(tokenKey(token));
      await this.cacheService.del(tokenMetaKey(token));
      return { valid: false, error: "Token expired" };
    }

    return { valid: true, data };
  },

  /**
   * Atomically consume a token for one specific linking flow.
   *
   * The record is read AND deleted in a single cache operation
   * (`getAndDel` ≙ Redis GETDEL), so under concurrency exactly one request
   * can win:
   *   Request A → SUCCESS (deletes the token)
   *   Request B → FAIL    (token is gone)
   *
   * Binding checks enforced here:
   * - session ownership (I.1): the token is bound to one User.id; a caller
   *   presenting a different userId is rejected
   * - platform binding: token issued for TELEGRAM cannot be consumed as X
   * - Telegram identity (I.11): identity = telegramUserId, never username.
   *   A replay with a different telegramUserId is rejected as an identity
   *   mismatch; the same identity replaying is rejected as already used.
   *
   * On any failure the token is destroyed (fail-closed): a failed attempt
   * burns the token, it never stays usable.
   *
   * @param token - The deep-link token.
   * @param context - Expected identity + platform values for binding.
   */
  async consume(
    token: string,
    context: {
      userId: string;
      platform: VerificationPlatform;
      telegramUserId: string;
      telegramUsername?: string;
    }
  ): Promise<{ success: true; data: VerificationTokenRecord } | { success: false; error: string }> {
    // 1. Replay guard: if this token was already consumed, reject with a
    //    precise typed error BEFORE touching the record.
    const meta = await this.cacheService.get<ConsumptionMeta>(tokenMetaKey(token));

    if (meta?.consumed === 1) {
      if (meta.telegramUserId && meta.telegramUserId !== context.telegramUserId) {
        // Same token replayed with a DIFFERENT Telegram identity (I.11).
        logger.warn(
          {
            token: redact(token),
            boundTelegramUserId: meta.telegramUserId,
            attemptedTelegramUserId: context.telegramUserId,
          },
          "[VerificationToken] Token replay with mismatched Telegram identity"
        );
        throw new TelegramIdentityMismatch(
          token,
          meta.telegramUserId,
          context.telegramUserId
        );
      }

      logger.warn(
        { token: redact(token), userId: context.userId },
        "[VerificationToken] Token replay detected (already used)"
      );
      throw new DeepLinkTokenAlreadyUsedError(token);
    }

    // 2. Atomic read + delete of the token record (single cache op).
    //    Under concurrency exactly ONE request can obtain the record; every
    //    other request observes null and fails (I.2 single-use).
    const recordJson = await this.cacheService.getAndDel(tokenKey(token));
    const record = recordJson
      ? (JSON.parse(recordJson) as VerificationTokenRecord)
      : null;

    if (!record) {
      // Never existed, expired (TTL), or was consumed in a race where the
      // metadata write has not landed yet — in every case: fail closed.
      return { success: false, error: "Token not found or expired" };
    }

    // 3. Expiry belt-and-braces (Redis TTL should already have removed it).
    if (Date.now() > record.expiresAt) {
      await this.cacheService.del(tokenKey(token));
      await this.cacheService.del(tokenMetaKey(token));
      return { success: false, error: "Token expired" };
    }

    // 4. Platform binding: the token was issued for one platform only.
    if (record.platform !== context.platform) {
      logger.warn(
        { token: redact(token), expectedPlatform: record.platform, contextPlatform: context.platform },
        "[VerificationToken] Token platform mismatch"
      );
      return { success: false, error: "Token was issued for a different platform" };
    }

    // 5. Session ownership (I.1): the token is bound to ONE real User.id.
    //    A token issued for User A can never be consumed for User B.
    if (record.userId !== context.userId) {
      logger.warn(
        { token: redact(token), recordUserId: record.userId, contextUserId: context.userId },
        "[VerificationToken] Token bound to a different user"
      );
      throw new DeepLinkTokenUserMismatchError(token, context.userId);
    }

    // 6. Identity binding (I.11): if the session was pre-bound to a specific
    //    telegramUserId, a different Telegram account is rejected. The
    //    identity is telegramUserId — username is never used as identity.
    if (record.telegramUserId && record.telegramUserId !== context.telegramUserId) {
      logger.warn(
        { token: redact(token), boundTelegramUserId: record.telegramUserId, attemptedTelegramUserId: context.telegramUserId },
        "[VerificationToken] Telegram identity mismatch"
      );
      throw new TelegramIdentityMismatch(
        token,
        record.telegramUserId,
        context.telegramUserId
      );
    }

    // 7. Record consumption BEFORE returning success so an immediate replay
    //    (including a concurrent one) hits the single-use guard.
    const consumptionMeta: ConsumptionMeta = {
      consumed: 1,
      telegramUserId: context.telegramUserId,
      consumedAt: Date.now(),
    };
    await this.cacheService.set(tokenMetaKey(token), consumptionMeta, TOKEN_TTL);

    // 8. Belt and braces: make sure no copy of the token record survives.
    await this.cacheService.del(tokenKey(token));

    logger.info(
      {
        userId: context.userId,
        telegramUserId: context.telegramUserId,
        platform: context.platform,
        token: redact(token),
      },
      "[VerificationToken] Token consumed (single-use enforced)"
    );

    return {
      success: true,
      data: {
        ...record,
        telegramUserId: context.telegramUserId,
        telegramUsername: context.telegramUsername,
      },
    };
  },
};

export default verificationTokenService;
