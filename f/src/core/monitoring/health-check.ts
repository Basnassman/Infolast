import { prisma } from "@core/db/prisma";

import { redis } from "@core/cache/redis";

export const healthCheck =
  async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;

      await redis.ping();

      return {
        status: "healthy",
      };
    } catch {
      return {
        status:
          "unhealthy",
      };
    }
  };