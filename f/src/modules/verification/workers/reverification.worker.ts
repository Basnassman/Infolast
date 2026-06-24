import { Worker, Job } from "bullmq";
import { redis } from "@core/cache/redis";
import { reverificationService } from "../services/reverification.service";
import { ReverificationJobData } from "../queues/reverification.queue";
import { logger } from "@core/logger/logger";

/**
 * =====================================================
 * REVERIFICATION WORKER
 * =====================================================
 *
 * Processes periodic reverification jobs from the reverification-queue.
 *
 * Anti-fraud protection:
 * - Rechecks all verified users to detect membership changes
 * - Revokes verification if a user left a channel/group
 */
const connection = redis.duplicate() as any;

export const reverificationWorker = new Worker(
  "reverification-queue",
  async (job: Job<ReverificationJobData>) => {
    const { verificationTaskId } = job.data;

    logger.info(
      { verificationTaskId, jobId: job.id },
      "[ReverificationWorker] Processing reverification job"
    );

    try {
      if (verificationTaskId) {
        // Reverify a specific task
        const result = await reverificationService.reverificationBatch(verificationTaskId);

        logger.info(
          {
            verificationTaskId,
            total: result.total,
            revoked: result.revoked,
            verified: result.verified,
            jobId: job.id,
          },
          "[ReverificationWorker] Batch reverification completed"
        );

        return result;
      } else {
        // Reverify all tasks
        const result = await reverificationService.reverificationAll();

        logger.info(
          {
            totalTasks: result.totalTasks,
            jobId: job.id,
          },
          "[ReverificationWorker] Full reverification sweep completed"
        );

        return result;
      }
    } catch (err) {
      logger.error(
        { err, verificationTaskId, jobId: job.id },
        "[ReverificationWorker] Reverification failed"
      );
      throw err;
    }
  },
  {
    connection,
    concurrency: 1, // Run one reverification at a time to avoid API rate limits
    limiter: {
      max: 5,
      duration: 60000, // 5 calls per minute for Telegram API
    },
  }
);

reverificationWorker.on("completed", (job) => {
  logger.debug({ jobId: job.id }, "[ReverificationWorker] Job completed");
});

reverificationWorker.on("failed", (job, err) => {
  logger.error(
    { jobId: job?.id, err },
    "[ReverificationWorker] Job failed"
  );
});
