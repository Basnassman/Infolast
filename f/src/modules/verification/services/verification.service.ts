import { prisma } from "@core/db/prisma";
import { VerificationPlatform, VerificationStatus, VerificationAction, VerificationResultStatus } from "@prisma/client";
import { VerifyContext } from "../types/verification.types";
import { providerFactory as coreProviderFactory } from "../providers/provider.factory";
import { platformAccountRepository as corePlatformAccountRepository } from "../repositories/platform-account.repository";
import { verificationTaskRepository as coreVerificationTaskRepository } from "../repositories/verification-task.repository";
import { userVerificationTaskRepository as coreUserVerificationTaskRepository } from "../repositories/user-verification-task.repository";
import { verificationLogRepository as coreVerificationLogRepository } from "../repositories/verification-log.repository";
import { cacheService as coreCacheService } from "@core/cache/cache.service";
import { verificationCacheKeys, VERIFICATION_CACHE_TTL } from "../types/verification.types";
import {
  VerificationTaskNotFoundError,
  PlatformAccountNotLinkedError,
  VerificationTaskAlreadyVerifiedError,
  RequiredVerificationMissingError,
} from "../errors/verification.errors";
import { logger } from "@core/logger/logger";

/**
 * =====================================================
 * VERIFICATION SERVICE
 * =====================================================
 * Main orchestration service for the Verification Module.
 * Coordinates between providers, repositories, and cache.
 *
 * Responsibilities:
 * - Verify user tasks against platform providers
 * - Manage verification status transitions (PENDING → VERIFIED → REVOKED)
 * - Log all verification actions
 * - Handle reverification (always a LIVE platform check)
 *
 * Architecture (Telegram API isolation):
 *   Task / Eligibility / Claim → verificationService → provider → Telegram API
 * Nothing outside this module calls api.telegram.org / getChatMember.
 *
 * Dependencies are declared as properties so the test suite can swap them
 * for fakes. Always call methods on the service object (not destructured).
 */
export const verificationService = {
  verificationTaskRepository: coreVerificationTaskRepository,
  userVerificationTaskRepository: coreUserVerificationTaskRepository,
  platformAccountRepository: corePlatformAccountRepository,
  verificationLogRepository: coreVerificationLogRepository,
  providerFactory: coreProviderFactory,
  cacheService: coreCacheService,

  /**
   * Verify a user's task completion against the platform provider.
   *
   * Flow:
   * 1. Load verification task
   * 2. Enforce required verification record (I.5) — missing record must
   *    NEVER be treated as verified; it throws RequiredVerificationMissingError.
   *    (Entry points create the PENDING record first via ensurePending.)
   * 3. Get platform account link
   * 4. Call provider.verify() (live unless cache explicitly allowed)
   * 5. Update status + log result
   *
   * @param canUseCache - true = normal verification (cache allowed as an
   *   optimization). false = security-critical check (claim gate /
   *   reverification) — the provider is queried live, cache is bypassed (I.4).
   */
  async verifyUserTask(
    userId: string,
    verificationTaskId: string,
    canUseCache: boolean = true
  ): Promise<{
    status: VerificationStatus;
    verifiedAt?: Date;
    details?: Record<string, unknown>;
  }> {
    // 1. Load verification task
    const task = await this.verificationTaskRepository.findById(verificationTaskId);
    if (!task) throw new VerificationTaskNotFoundError(verificationTaskId);

    if (!task.isActive) {
      return { status: VerificationStatus.REJECTED };
    }

    // 2. Enforce required verification (I.5): a missing verification record
    //    for a required task must NOT be treated as VERIFIED / eligible.
    //    Defensive state: RequiredVerificationMissingError
    //    (verification fails: NOT_VERIFIED).
    const existing = await this.userVerificationTaskRepository.findByUserAndTask(
      userId,
      verificationTaskId
    );

    if (!existing) {
      logger.warn(
        { userId, verificationTaskId },
        "[Verification] Required verification record missing - rejecting"
      );
      throw new RequiredVerificationMissingError(userId, verificationTaskId);
    }

    // 3. Get platform account
    const platformAccount = await this.platformAccountRepository.findByUserAndPlatform(
      userId,
      task.platform
    );

    if (!platformAccount || !platformAccount.verified) {
      throw new PlatformAccountNotLinkedError(userId, task.platform);
    }

    // 4. Get provider and verify
    const provider = this.providerFactory.get(task.platform);

    const verifyContext = {
      userId,
      taskId: verificationTaskId,
      platform: task.platform,
      channelIdentifier: task.channelIdentifier ?? undefined,
      channelUrl: task.channelUrl ?? undefined,
      metadata: {
        platformUserId: platformAccount.platformUserId,
        platformUsername: platformAccount.platformUsername,
      },
    } as VerifyContext;

    let providerResult: {
      success: boolean;
      isMember: boolean;
      status?: string;
      error?: string;
      details?: Record<string, unknown>;
    };

    if (canUseCache) {
      // Normal verification: cache may be used as an optimization only.
      const cacheKey = verificationCacheKeys.memberCheck(
        task.platform,
        task.channelIdentifier ?? "",
        platformAccount.platformUserId
      );

      const cached = await this.cacheService.get<{
        success: boolean;
        isMember: boolean;
        status?: string;
        error?: string;
        details?: Record<string, unknown>;
      }>(cacheKey);

      if (cached) {
        logger.debug(
          { userId, channelIdentifier: task.channelIdentifier, platformUserId: platformAccount.platformUserId },
          "[Verification] Using cached verification result"
        );
        providerResult = cached;
      } else {
        // Cache miss: do a live check (no optimistic short-circuit)
        providerResult = await provider.verify(verifyContext, true);
        if (task.channelIdentifier && platformAccount.platformUserId) {
          this.cacheService.set(
            cacheKey,
            providerResult,
            VERIFICATION_CACHE_TTL.memberCheck
          );
        }
      }
    } else {
      // Security-critical live check (claim gate / reverification):
      // always query Telegram, never read from cache (I.4).
      providerResult = await provider.verify(verifyContext, false);
    }

    const result = providerResult;

    // 5. Determine new status (I.6 lifecycle):
    //    - member            → VERIFIED
    //    - not member while previously VERIFIED → REVOKED
    //    - not member otherwise → REJECTED
    const newStatus = result.isMember
      ? VerificationStatus.VERIFIED
      : existing.status === VerificationStatus.VERIFIED
        ? VerificationStatus.REVOKED
        : VerificationStatus.REJECTED;

    const verifiedAt = newStatus === VerificationStatus.VERIFIED ? new Date() : null;

    // 6. Upsert user verification task
    const userVerification = await this.userVerificationTaskRepository.upsert(
      userId,
      verificationTaskId,
      { status: newStatus }
    );

    if (newStatus === VerificationStatus.VERIFIED) {
      await this.userVerificationTaskRepository.update(userVerification.id, {
        status: newStatus,
        verifiedAt: verifiedAt ?? undefined,
        lastCheckedAt: new Date(),
      });
    } else {
      await this.userVerificationTaskRepository.update(userVerification.id, {
        status: newStatus,
        lastCheckedAt: new Date(),
      });
    }

    // 7. Log the verification (VERIFY for the first check of a PENDING
    //    record, REVERIFY for every subsequent live check)
    await this.verificationLogRepository.create({
      userId,
      verificationTaskId,
      userVerificationTaskId: userVerification.id,
      action:
        existing.status === VerificationStatus.PENDING
          ? VerificationAction.VERIFY
          : VerificationAction.REVERIFY,
      result: result.success && result.isMember
        ? VerificationResultStatus.SUCCESS
        : VerificationResultStatus.FAILED,
      details: {
        ...result.details,
        error: result.error,
        isMember: result.isMember,
        status: result.status,
      },
    });

    logger.info(
      {
        userId,
        verificationTaskId,
        platform: task.platform,
        previousStatus: existing.status,
        newStatus,
        isMember: result.isMember,
      },
      "[Verification] Task verification completed"
    );

    return {
      status: newStatus,
      verifiedAt: verifiedAt ?? undefined,
      details: result.details,
    };
  },

  /**
   * Reverify a single user verification task.
   *
   * I.3 requirement: the result MUST reflect the current Telegram API state.
   * It is a hard NO-OP to treat an existing VERIFIED record as proof of
   * membership.
   *
   * Always queries the Telegram provider for the live membership status
   * (cache bypassed — I.4), then persists the freshly observed state, so a
   * user who left the group is REVOKED (I.6).
   *
   * The re-verification counters live in reverification.service.ts and only
   * count actual membership changes — never cache hits, never plain reads.
   */
  async reverificationCheck(
    userId: string,
    verificationTaskId: string
  ): Promise<{
    status: VerificationStatus;
    changed: boolean;
  }> {
    // 1. Load the verification task
    const task = await this.verificationTaskRepository.findById(verificationTaskId);
    if (!task) {
      return { status: VerificationStatus.REJECTED, changed: false };
    }

    // 2. Enforce required verification (I.5): no record → cannot be verified.
    const existing = await this.userVerificationTaskRepository.findByUserAndTask(
      userId,
      verificationTaskId
    );

    if (!existing) {
      logger.warn(
        { userId, verificationTaskId },
        "[Verification] Reverification rejected - no required verification record"
      );
      return { status: VerificationStatus.REJECTED, changed: false };
    }

    // 3. Load the linked platform account — the platform identity
    //    (telegramUserId) comes from PlatformAccount, never from username.
    const platformAccount = await this.platformAccountRepository.findByUserAndPlatform(
      userId,
      task.platform
    );

    // 4. Always run a LIVE membership check. A cached "VERIFIED" from
    //    15 minutes ago must never hide an expired membership (I.3/I.4).
    //    If the platform account is not linked anymore, membership cannot be
    //    confirmed → treated as "not a member" (fail closed).
    const provider = this.providerFactory.get(task.platform);
    const result = platformAccount && platformAccount.verified
      ? await provider.verify({
          userId,
          taskId: verificationTaskId,
          platform: task.platform,
          channelIdentifier: task.channelIdentifier ?? undefined,
          channelUrl: task.channelUrl ?? undefined,
          metadata: {
            platformUserId: platformAccount.platformUserId,
            platformUsername: platformAccount.platformUsername,
          },
        }, false)
      : {
          success: false,
          isMember: false,
          error: "Platform account not linked",
        };

    // 5. Status transition (I.6): VERIFIED → REVOKED when membership is gone.
    const newStatus = result.isMember
      ? VerificationStatus.VERIFIED
      : existing.status === VerificationStatus.VERIFIED
        ? VerificationStatus.REVOKED
        : VerificationStatus.REJECTED;

    // 6. Persist the new observed state
    if (newStatus === VerificationStatus.VERIFIED) {
      await this.userVerificationTaskRepository.update(existing.id, {
        status: newStatus,
        verifiedAt: new Date(),
        lastCheckedAt: new Date(),
      });
    } else {
      await this.userVerificationTaskRepository.update(existing.id, {
        status: newStatus,
        lastCheckedAt: new Date(),
      });
    }

    // 7. Log the live result
    await this.verificationLogRepository.create({
      userId,
      verificationTaskId,
      userVerificationTaskId: existing.id,
      action: VerificationAction.REVERIFY,
      result: result.success && result.isMember
        ? VerificationResultStatus.SUCCESS
        : VerificationResultStatus.FAILED,
      details: {
        ...result.details,
        error: result.error,
        isMember: result.isMember,
        status: result.status,
      },
    });

    const changed = newStatus !== existing.status;

    logger.info(
      {
        userId,
        verificationTaskId,
        previousStatus: existing.status,
        newStatus,
        isMember: result.isMember,
        changed,
      },
      "[Verification] Reverification completed"
    );

    return { status: newStatus, changed };
  },

  /**
   * Get all verified tasks for a user.
   */
  async getUserVerifiedTasks(userId: string) {
    return this.userVerificationTaskRepository.findVerifiedByUser(userId);
  },

  /**
   * Get verification status for a specific task.
   * Missing record → PENDING (i.e. NOT verified — never fabricated).
   */
  async getVerificationStatus(userId: string, verificationTaskId: string) {
    const uvt = await this.userVerificationTaskRepository.findByUserAndTask(
      userId,
      verificationTaskId
    );

    return {
      status: uvt?.status ?? VerificationStatus.PENDING,
      verifiedAt: uvt?.verifiedAt,
      lastCheckedAt: uvt?.lastCheckedAt,
    };
  },

  /**
   * Invalidate cache for a user's verification results.
   */
  async invalidateCache(userId: string): Promise<void> {
    const key = verificationCacheKeys.eligibility(userId);
    await this.cacheService.del(key);
  },
};
