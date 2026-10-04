import { Worker, Job } from "bullmq";
import { redis } from "@core/cache/redis";
import { verificationService } from "../services/verification.service";
import { userVerificationTaskRepository } from "../repositories/user-verification-task.repository";
import { VerificationJobData } from "../queues/verification.queue";
import { logger } from "@core/logger/logger";

/**
 * =====================================================
 * VERIFICATION WORKER
 * =====================================================
 *
 * Processes on-demand verification jobs from the verification-queue.
 *
 * Responsibilities:
 * - Verify user task completion against platform providers
 * - Update verification status in database
 * - Log verification results
 */
const connection = redis.duplicate() as any;

export const verificationWorker = new Worker(
  "verification-queue",
  async (job: Job<VerificationJobData>) => {
    const { userId, verificationTaskId, walletAddress } = job.data;

    logger.info(
      { userId, verificationTaskId, jobId: job.id },
      "[VerificationWorker] Processing verification job"
    );

    try {
      // I.5: ensure the required verification record exists (PENDING) before
      // running the live check — verifyUserTask fails closed on a missing
      // record and never fabricates VERIFIED.
      await userVerificationTaskRepository.ensurePending(
        userId,
        verificationTaskId
      );

      const result = await verificationService.verifyUserTask(
        userId,
        verificationTaskId
      );

      logger.info(
        {
          userId,
          verificationTaskId,
          status: result.status,
          jobId: job.id,
        },
        "[VerificationWorker] Verification completed"
      );

      return result;
    } catch (err) {
      logger.error(
        { err, userId, verificationTaskId, jobId: job.id },
        "[VerificationWorker] Verification failed"
      );
      throw err; // BullMQ will retry
    }
  },
  {
    connection,
    concurrency: 5,
    limiter: {
      max: 20,
      duration: 1000,
    },
  }
);

verificationWorker.on("completed", (job) => {
  logger.debug({ jobId: job.id }, "[VerificationWorker] Job completed");
});

verificationWorker.on("failed", (job, err) => {
  logger.error(
    { jobId: job?.id, err },
    "[VerificationWorker] Job failed"
  );
});
