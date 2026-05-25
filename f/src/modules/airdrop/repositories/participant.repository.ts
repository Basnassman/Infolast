import { prisma } from "../../../core/db/prisma";

export const participantRepository = {
  async findByUserId(userId: string) {
    return prisma.airdropParticipant.findUnique({
      where: { userId },
      include: {
        user: true,
      },
    });
  },

  async create(userId: string) {
    return prisma.airdropParticipant.create({
      data: {
        userId,
        points: 0,
        allocationWei: "0",
        isEligible: false,
        airdropDirty: true,
      },
      include: {
        user: true,
      },
    });
  },

  async getOrCreate(userId: string) {
    const existing =
      await this.findByUserId(userId);

    if (existing) {
      return existing;
    }

    return this.create(userId);
  },

  async updateAllocation(
    participantId: string,
    data: {
      points: number;
      allocationWei: string;
      isEligible: boolean;
    }
  ) {
    return prisma.airdropParticipant.update({
      where: {
        id: participantId,
      },
      data: {
        points: data.points,
        allocationWei: data.allocationWei,
        isEligible: data.isEligible,
        airdropDirty: true,
        lastCalculatedAt: new Date(),
      },
    });
  },

  async findEligibleParticipants() {
    return prisma.airdropParticipant.findMany({
      where: {
        isEligible: true,
        allocationWei: {
          not: "0",
        },
      },
      include: {
        user: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });
  },

  async markClean(ids: string[]) {
    if (!ids.length) {
      return;
    }

    return prisma.airdropParticipant.updateMany({
      where: {
        id: {
          in: ids,
        },
      },
      data: {
        airdropDirty: false,
      },
    });
  },
};