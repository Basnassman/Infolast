import { Queue } from "bullmq";
import { redis } from "@core/cache/redis";

const connection = redis.duplicate() as any;

/**
 * Queue for periodic reverification of all verified users.
 *
 * Runs on a schedule (cron) to detect users who left
 * a channel/group after initial verification.
 */
export const reverificationQueue = new Queue("reverification-queue", {
  connection,
  defaultJobOptions: {
    removeOnComplete: 20,
    removeOnFail: 10,
    attempts: 2,
    backoff: {
      type: "exponential",
      delay: 10000,
    },
  },
});

export interface ReverificationJobData {
  verificationTaskId?: string; // If set, reverify only this task. Otherwise, reverify all.
}
