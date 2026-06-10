import { Queue } from "bullmq";

import { redis } from "@core/cache/redis";

const connection =
  redis.duplicate() as any;

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