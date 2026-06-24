import { prisma } from "@core/db/prisma";
import { VerificationPlatform, PlatformAccount } from "@prisma/client";

export interface LinkPlatformAccountInput {
  userId: string;
  platform: VerificationPlatform;
  platformUserId: string;
  platformUsername?: string;
}

export const platformAccountRepository = {
  async findByUserAndPlatform(
    userId: string,
    platform: VerificationPlatform
  ): Promise<PlatformAccount | null> {
    return prisma.platformAccount.findUnique({
      where: { userId_platform: { userId, platform } },
    });
  },

  async findByPlatformUserId(
    platform: VerificationPlatform,
    platformUserId: string
  ): Promise<PlatformAccount | null> {
    return prisma.platformAccount.findFirst({
      where: { platform, platformUserId },
    });
  },

  async link(input: LinkPlatformAccountInput): Promise<PlatformAccount> {
    return prisma.platformAccount.upsert({
      where: {
        userId_platform: {
          userId: input.userId,
          platform: input.platform,
        },
      },
      create: {
        userId: input.userId,
        platform: input.platform,
        platformUserId: input.platformUserId,
        platformUsername: input.platformUsername,
        verified: true,
      },
      update: {
        platformUserId: input.platformUserId,
        platformUsername: input.platformUsername,
        verified: true,
      },
    });
  },

  async unlink(userId: string, platform: VerificationPlatform): Promise<void> {
    await prisma.platformAccount.deleteMany({
      where: { userId, platform },
    });
  },

  async findByUser(userId: string): Promise<PlatformAccount[]> {
    return prisma.platformAccount.findMany({
      where: { userId },
    });
  },

  async countByPlatform(platform: VerificationPlatform): Promise<number> {
    return prisma.platformAccount.count({
      where: { platform, verified: true },
    });
  },
};
