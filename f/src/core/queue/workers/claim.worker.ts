import { Worker } from "bullmq";

import IORedis from "ioredis";

import { logger } from "../../logger/logger";

import { env } from "../../config/env";

const connection =
  new IORedis(
    env.redisUrl,
    {
      maxRetriesPerRequest:
        null,
    }
  );

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