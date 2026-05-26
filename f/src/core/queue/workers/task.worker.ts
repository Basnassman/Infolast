import { Worker } from "bullmq";

import IORedis from "ioredis";

import { logger } from "@core/logger/logger";

import { env } from "@core/config/env";

const connection =
  new IORedis(
    env.redisUrl,
    {
      maxRetriesPerRequest:
        null,
    }
  );

export const taskWorker =
  new Worker(
    "task-queue",

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