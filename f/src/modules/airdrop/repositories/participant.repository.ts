import { prisma } from "@core/db/prisma";
import { UserStatus } from "@prisma/client";

export const getEligibleParticipants = async () => {
  return prisma.airdropParticipant.findMany({
    where: {
      isEligible: true,           // ✅ Boolean
      points: { gt: 0 },          // ✅ Int
      user: {
        status: UserStatus.ACTIVE, // ✅ Enum
      },
    },
    include: {
      user: true,                 // ✅ Relation
    },
    orderBy: {
      points: "desc",             // ✅ Int
    },
  });
};

export const getDirtyParticipants = async () => {
  return prisma.airdropParticipant.findMany({
    where: {
      airdropDirty: true,         // ✅ Boolean
    },
    include: {
      user: true,                 // ✅ Relation
    },
  });
};

export const updateAllocation = async (
  participantId: string,
  allocationWei: string
) => {
  return prisma.airdropParticipant.update({
    where: { id: participantId },
    data: {
      allocationWei,              // ✅ String
      airdropDirty: false,        // ✅ Boolean
      lastCalculatedAt: new Date(), // ✅ DateTime?
    },
  });
};

export const markDirty = async (participantId: string) => {
  return prisma.airdropParticipant.update({
    where: { id: participantId },
    data: { airdropDirty: true }, // ✅ Boolean
  });
};

export const clearDirty = async (participantId: string) => {
  return prisma.airdropParticipant.update({
    where: { id: participantId },
    data: { airdropDirty: false }, // ✅ Boolean
  });
};
