import { prisma } from "@core/db/prisma";
import { VerificationPlatform, VerificationStatus, VerificationAction, VerificationResultStatus } from "@prisma/client";
import { providerFactory } from "../providers/provider.factory";
import { platformAccountRepository } from "../repositories/platform-account.repository";
import { verificationTaskRepository } from "../repositories/verification-task.repository";
import { userVerificationTaskRepository } from "../repositories/user-verification-task.repository";
import { verificationLogRepository } from "../repositories/verification-log.repository";
import { cacheService } from "@core/cache/cache.service";
import { verificationCacheKeys } from "../types/verification.types";
import {
  VerificationTaskNotFoundError,
  PlatformAccountNotLinkedError,
  VerificationTaskAlreadyVerifiedError,
} from "../errors/verification.errors";
import { logger } from "@core/logger/logger";

/**
 * =====================================================
 * VERIFICATION SERVICE
 * =====================================================
 *
 * Main orchestration service for the Verification Module.
 * Coordinates between providers, repositories, and cache.
 *
 * Responsibilities:
 * - Verify user tasks against platform providers
 * - Manage verification status transitions
 * - Log all verification actions
 * - Handle reverification
 */
export const verificationService = {
  /**
   * Verify a user's task completion against the platform provider.
   *
   * Flow:
   * 1. Load verification task
   * 2. Check if already verified (idempotent)
   * 3. Get platform account link
   * 4. Call provider.verify()
   * 5. Update status + log result
   */
  async verifyUserTask(
    userId: string,
    verificationTaskId: string
  ): Promise<{
    status: VerificationStatus;
    verifiedAt?: Date;
    details?: Record<string, unknown>;
  }> {
    // 1. Load verification task
    const task = await verificationTaskRepository.findById(verificationTaskId);
    if (!task) throw new VerificationTaskNotFoundError(verificationTaskId);

    if (!task.isActive) {
      return { status: VerificationStatus.REJECTED };
    }

    // 2. Check existing verification
    const existing = await userVerificationTaskRepository.findByUserAndTask(
      userId,
      verificationTaskId
    );

    if (existing?.status === VerificationStatus.VERIFIED) {
      return {
        status: VerificationStatus.VERIFIED,
        verifiedAt: existing.verifiedAt ?? undefined,
      };
    }

    // 3. Get platform account
    const platformAccount = await platformAccountRepository.findByUserAndPlatform(
      userId,
      task.platform
    );

    if (!platformAccount || !platformAccount.verified) {
      throw new PlatformAccountNotLinkedError(userId, task.platform);
    }

    // 4. Get provider and verify
    const provider = providerFactory.get(task.platform);

    const result = await provider.verify({
      userId,
      taskId: verificationTaskId,
      platform: task.platform,
      channelIdentifier: task.channelIdentifier ?? undefined,
      channelUrl: task.channelUrl ?? undefined,
      metadata: {
        platformUserId: platformAccount.platformUserId,
        platformUsername: platformAccount.platformUsername,
      },
    });

    // 5. Determine new status
    const newStatus = result.isMember
      ? VerificationStatus.VERIFIED
      : VerificationStatus.REJECTED;

    const verifiedAt = newStatus === VerificationStatus.VERIFIED ? new Date() : null;

    // 6. Upsert user verification task
    const userVerification = await userVerificationTaskRepository.upsert(
      userId,
      verificationTaskId,
      { status: newStatus }
    );

    if (newStatus === VerificationStatus.VERIFIED) {
      await userVerificationTaskRepository.update(userVerification.id, {
        status: newStatus,
        verifiedAt: verifiedAt ?? undefined,
        lastCheckedAt: new Date(),
      });
    } else {
      await userVerificationTaskRepository.update(userVerification.id, {
        status: newStatus,
        lastCheckedAt: new Date(),
      });
    }

    // 7. Log the verification
    await verificationLogRepository.create({
      userId,
      verificationTaskId,
      userVerificationTaskId: userVerification.id,
      action: existing ? VerificationAction.REVERIFY : VerificationAction.VERIFY,
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
   * Used by periodic reverification and pre-claim checks.
   */
  async reverificationCheck(
    userId: string,
    verificationTaskId: string
  ): Promise<{
    status: VerificationStatus;
    changed: boolean;
  }> {
    const existing = await userVerificationTaskRepository.findByUserAndTask(
      userId,
      verificationTaskId
    );

    if (!existing || existing.status !== VerificationStatus.VERIFIED) {
      return {
        status: existing?.status ?? VerificationStatus.PENDING,
        changed: false,
      };
    }

    // Re-run verification
    const result = await this.verifyUserTask(userId, verificationTaskId);
    const changed = result.status !== existing.status;

    return { status: result.status, changed };
  },

  /**
   * Get all verified tasks for a user.
   */
  async getUserVerifiedTasks(userId: string) {
    return userVerificationTaskRepository.findVerifiedByUser(userId);
  },

  /**
   * Get verification status for a specific task.
   */
  async getVerificationStatus(userId: string, verificationTaskId: string) {
    const uvt = await userVerificationTaskRepository.findByUserAndTask(
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
    await cacheService.del(key);
  },
};
