import { prisma } from "@core/db/prisma";

import {
  UserStatus,
} from "@prisma/client";

export const getEligibleParticipants =
  async () => {
    return prisma.airdropParticipant.findMany({
      where: {
        isEligible: true,

        points: {
          gt: 0,
        },

        user: {
          status: UserStatus.ACTIVE,
        },
      },

      include: {
        user: true,
      },

      orderBy: {
        points: "desc",
      },
    });
  };

export const getDirtyParticipants =
  async () => {
    return prisma.airdropParticipant.findMany({
      where: {
        airdropDirty: true,
      },

      include: {
        user: true,
      },
    });
  };

export const updateAllocation =
  async (
    participantId: string,
    allocationWei: string
  ) => {
    return prisma.airdropParticipant.update({
      where: {
        id: participantId,
      },

      data: {
        allocationWei,

        airdropDirty: false,

        lastCalculatedAt:
          new Date(),
      },
    });
  };

export const markDirty =
  async (
    participantId: string
  ) => {
    return prisma.airdropParticipant.update({
      where: {
        id: participantId,
      },

      data: {
        airdropDirty: true,
      },
    });
  };

export const clearDirty =
  async (
    participantId: string
  ) => {
    return prisma.airdropParticipant.update({
      where: {
        id: participantId,
      },

      data: {
        airdropDirty: false,
      },
    });
  };
