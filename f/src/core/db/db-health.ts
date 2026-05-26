import { prisma } from "./prisma";

export const dbHealth =
  async () => {
    try {
      await prisma.$queryRaw`
        SELECT 1
      `;

      return {
        healthy: true,
      };
    } catch (
      error
    ) {
      return {
        healthy: false,
      };
    }
  };