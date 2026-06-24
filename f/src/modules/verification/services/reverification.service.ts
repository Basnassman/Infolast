import { prisma } from "@core/db/prisma";
import { VerificationStatus } from "@prisma/client";
import { userVerificationTaskRepository } from "../repositories/user-verification-task.repository";
import { verificationTaskRepository } from "../repositories/verification-task.repository";
import { verificationService } from "./verification.service";
import { ReverificationResult, ReverificationBatchResult } from "../types/verification.types";
import { logger } from "@core/logger/logger";

/**
 * =====================================================
 * REVERIFICATION SERVICE
 * =====================================================
 *
 * Periodically rechecks all verified users to detect:
 * - Users who left a Telegram group
 * - Users who unfollowed on X
 * - Any membership change
 *
 * Anti-fraud protection:
 * - Detects "join → verify → receive reward → leave" attacks
 * - Revokes verification if membership is lost
 *
 * Triggered by:
 * 1. Cron job (periodic reverification)
 * 2. Before claim (pre-claim check)
 * 3. Before vesting release
 */
export const reverificationService = {
  /**
   * Reverify all verified users for a specific verification task.
   *
   * Returns batch results with counts of verified/revoked/failed.
   */
  async reverificationBatch(
    verificationTaskId: string
  ): Promise<ReverificationBatchResult> {
    const allVerified = await userVerificationTaskRepository.findAllVerified();
    const targetVerifications = allVerified.filter(
      (uv) => uv.verificationTaskId === verificationTaskId
    );

    logger.info(
      {
        verificationTaskId,
        totalToCheck: targetVerifications.length,
      },
      "[Reverification] Starting batch reverification"
    );

    const results: ReverificationResult[] = [];
    let verified = 0;
    let revoked = 0;
    let failed = 0;

    for (const uv of targetVerifications) {
      try {
        const result = await verificationService.reverificationCheck(
          uv.userId,
          uv.verificationTaskId
        );

        const reverificationResult: ReverificationResult = {
          userId: uv.userId,
          verificationTaskId: uv.verificationTaskId,
          previousStatus: uv.status,
          newStatus: result.status,
          changed: result.changed,
        };

        results.push(reverificationResult);

        if (result.changed) {
          if (result.status === VerificationStatus.REVOKED) {
            revoked++;
          } else {
            verified++;
          }
        }
      } catch (err) {
        failed++;
        results.push({
          userId: uv.userId,
          verificationTaskId: uv.verificationTaskId,
          previousStatus: uv.status,
          newStatus: uv.status,
          changed: false,
          error: err instanceof Error ? err.message : "Unknown error",
        });

        logger.error(
          { err, userId: uv.userId, verificationTaskId },
          "[Reverification] Failed to reverify user"
        );
      }
    }

    const batchResult: ReverificationBatchResult = {
      total: targetVerifications.length,
      verified,
      revoked,
      failed,
      results,
    };

    logger.info(
      {
        verificationTaskId,
        total: batchResult.total,
        verified: batchResult.verified,
        revoked: batchResult.revoked,
        failed: batchResult.failed,
      },
      "[Reverification] Batch reverification completed"
    );

    return batchResult;
  },

  /**
   * Reverify all verification tasks for all platforms.
   * Called by the cron scheduler.
   */
  async reverificationAll(): Promise<{
    totalTasks: number;
    results: Array<{ taskTitle: string; platform: string; revoked: number; verified: number }>;
  }> {
    const activeTasks = await verificationTaskRepository.findActive();

    logger.info(
      { totalTasks: activeTasks.length },
      "[Reverification] Starting full reverification sweep"
    );

    const results: Array<{
      taskTitle: string;
      platform: string;
      revoked: number;
      verified: number;
    }> = [];

    for (const task of activeTasks) {
      try {
        const batchResult = await this.reverificationBatch(task.id);
        results.push({
          taskTitle: task.title,
          platform: task.platform,
          revoked: batchResult.revoked,
          verified: batchResult.verified,
        });
      } catch (err) {
        logger.error(
          { err, taskId: task.id },
          "[Reverification] Failed batch for task"
        );
        results.push({
          taskTitle: task.title,
          platform: task.platform,
          revoked: 0,
          verified: 0,
        });
      }
    }

    return { totalTasks: activeTasks.length, results };
  },
};
