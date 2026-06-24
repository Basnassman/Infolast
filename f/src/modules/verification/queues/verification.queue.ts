import { Queue } from "bullmq";
import { redis } from "@core/cache/redis";

const connection = redis.duplicate() as any;

/**
 * Queue for on-demand task verification.
 *
 * When a user submits a task, a job is added here
 * to verify their platform membership asynchronously.
 */
export const verificationQueue = new Queue("verification-queue", {
  connection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
  },
});

export interface VerificationJobData {
  userId: string;
  verificationTaskId: string;
  walletAddress: string;
}
