import { Worker } from "bullmq";
import { logger } from "@core/logger/logger";
import { redis } from "@core/cache/redis";



const connection =
  redis.duplicate() as any;

export const claimWorker =
  new Worker(
    "claim-queue",

    async (job) => {
      logger.info({
        jobId: job.id,
        data: job.data,
      });
    },

    {
      connection,
    }
  );