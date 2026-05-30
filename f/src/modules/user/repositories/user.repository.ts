import { prisma } from "@core/db/prisma";
import { User, UserStatus } from "@prisma/client";

export const userRepository = {
  async findByWallet(walletAddress: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { walletAddress },
      include: {
        riskProfile: true,
        airdropParticipant: true,
      },
    });
  },

  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
      include: {
        riskProfile: true,
        airdropParticipant: true,
      },
    });
  },

  async create(walletAddress: string): Promise<User> {
    return prisma.user.create({
      data: {
        walletAddress,
        status: UserStatus.ACTIVE,
      },
    });
  },

  async findOrCreate(walletAddress: string): Promise<User> {
    const existing = await this.findByWallet(walletAddress);
    if (existing) return existing;
    return this.create(walletAddress);
  },
};