import { Worker } from "bullmq";
import { rebuildAndSync } from "@modules/airdrop/workers/rebuild.worker";
import { logger } from "@core/logger/logger";
import { redis } from "@core/cache/redis";



const connection =
  redis.duplicate() as any;


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