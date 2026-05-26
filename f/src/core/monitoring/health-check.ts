import { prisma } from "../db/prisma";

import { redis } from "../cache/redis";

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