import { Worker } from "bullmq";

import IORedis from "ioredis";

import { rebuildAndSync } from "../../../modules/airdrop/workers/rebuild.worker";

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

export const rebuildWorker =
  new Worker(
    "rebuild-queue",

    async () => {
      logger.info(
        "Starting rebuild job"
      );

      await rebuildAndSync();

      logger.info(
        "Rebuild job completed"
      );
    },

    {
      connection,
    }
  );