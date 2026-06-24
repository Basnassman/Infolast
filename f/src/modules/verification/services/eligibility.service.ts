import { prisma } from "@core/db/prisma";
import { VerificationPlatform, VerificationStatus } from "@prisma/client";
import { verificationService } from "./verification.service";
import { verificationTaskRepository } from "../repositories/verification-task.repository";
import { userVerificationTaskRepository } from "../repositories/user-verification-task.repository";
import { cacheService } from "@core/cache/cache.service";
import { verificationCacheKeys, VERIFICATION_CACHE_TTL } from "../types/verification.types";
import { logger } from "@core/logger/logger";

/**
 * =====================================================
 * VERIFICATION ELIGIBILITY SERVICE
 * =====================================================
 *
 * Independent service called by other modules to check
 * if a user is eligible for claims, vesting, airdrops, etc.
 *
 * This is the ONLY interface other modules should use.
 * It does NOT depend on any specific platform (Telegram, X, etc.)
 *
 * Usage from other modules:
 *   import { verificationEligibilityService } from "@modules/verification/services/eligibility.service";
 *
 *   const result = await verificationEligibilityService.checkEligibility(userId);
 *   if (!result.eligible) { reject claim; }
 */
export const verificationEligibilityService = {
  /**
   * Check if a user is fully eligible across all verified verification tasks.
   *
   * A user is eligible if ALL active verification tasks they have verified for
   * are still in VERIFIED status (not REVOKED).
   *
   * This performs a quick check against the database, not a live platform check.
   * For live checks, use verifyBeforeClaim() instead.
   */
  async checkEligibility(
    userId: string
  ): Promise<{ eligible: boolean; failedTasks: string[] }> {
    // Check cache first
    const cacheKey = verificationCacheKeys.eligibility(userId);
    const cached = await cacheService.get<{ eligible: boolean; failedTasks: string[] }>(cacheKey);
    if (cached) return cached;

    // Get all active verification tasks
    const activeTasks = await verificationTaskRepository.findActive();

    if (activeTasks.length === 0) {
      // No verification tasks configured → everyone is eligible
      return { eligible: true, failedTasks: [] };
    }

    // Get user's verification statuses
    const userVerifications = await userVerificationTaskRepository.findByUser(userId);
    const verificationMap = new Map(
      userVerifications.map((uv) => [uv.verificationTaskId, uv.status])
    );

    const failedTasks: string[] = [];

    for (const task of activeTasks) {
      const status = verificationMap.get(task.id);

      if (status === VerificationStatus.REVOKED) {
        failedTasks.push(task.id);
      } else if (status !== VerificationStatus.VERIFIED) {
        // Not yet verified → not eligible
        failedTasks.push(task.id);
      }
      // VERIFIED → pass
    }

    const result = {
      eligible: failedTasks.length === 0,
      failedTasks,
    };

    // Cache the result
    await cacheService.set(cacheKey, result, VERIFICATION_CACHE_TTL.eligibility);

    return result;
  },

  /**
   * Live verification check before a claim is processed.
   *
   * This performs a REAL platform check (not cached) to ensure
   * the user is still a valid member before releasing tokens.
   *
   * Use this for high-value operations:
   * - Airdrop claims
   * - Vesting releases
   * - Token distributions
   */
  async verifyBeforeClaim(
    userId: string
  ): Promise<{ eligible: boolean; failedTasks: Array<{ taskId: string; title: string; platform: VerificationPlatform }> }> {
    const activeTasks = await verificationTaskRepository.findActive();

    if (activeTasks.length === 0) {
      return { eligible: true, failedTasks: [] };
    }

    const failedTasks: Array<{ taskId: string; title: string; platform: VerificationPlatform }> = [];

    for (const task of activeTasks) {
      // Skip tasks the user hasn't verified for yet
      const existing = await userVerificationTaskRepository.findByUserAndTask(userId, task.id);
      if (!existing || existing.status !== VerificationStatus.VERIFIED) {
        // If the task requires verification and user hasn't done it, skip
        // (they shouldn't be at the claim stage without prior verification)
        continue;
      }

      // Perform live reverification
      try {
        const result = await verificationService.verifyUserTask(userId, task.id);

        if (result.status !== VerificationStatus.VERIFIED) {
          failedTasks.push({
            taskId: task.id,
            title: task.title,
            platform: task.platform,
          });
        }
      } catch (err) {
        logger.error(
          { err, userId, taskId: task.id },
          "[Eligibility] Live verification failed"
        );
        // On error, fail safe — mark as not eligible
        failedTasks.push({
          taskId: task.id,
          title: task.title,
          platform: task.platform,
        });
      }
    }

    // Invalidate cache after live check
    await cacheService.del(verificationCacheKeys.eligibility(userId));

    return {
      eligible: failedTasks.length === 0,
      failedTasks,
    };
  },

  /**
   * Check eligibility for a specific platform.
   *
   * Useful when only Telegram verification matters for a specific action.
   */
  async checkPlatformEligibility(
    userId: string,
    platform: VerificationPlatform
  ): Promise<{ eligible: boolean; verifiedCount: number; requiredCount: number }> {
    const activeTasks = await verificationTaskRepository.findActiveByPlatform(platform);
    const verifiedCount = await userVerificationTaskRepository.countVerifiedByUserAndPlatform(
      userId,
      platform
    );

    return {
      eligible: verifiedCount >= activeTasks.length,
      verifiedCount,
      requiredCount: activeTasks.length,
    };
  },
};
