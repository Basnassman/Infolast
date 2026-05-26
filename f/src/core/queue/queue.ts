import { Queue } from "bullmq";

import IORedis from "ioredis";

import { env } from "@core/config/env";

const connection =
  new IORedis(
    env.redisUrl,
    {
      maxRetriesPerRequest:
        null,
    }
  );

export const rebuildQueue =
  new Queue(
    "rebuild-queue",
    {
      connection,
    }
  );

export const claimQueue =
  new Queue(
    "claim-queue",
    {
      connection,
    }
  );

export const taskQueue =
  new Queue(
    "task-queue",
    {
      connection,
    }
  );