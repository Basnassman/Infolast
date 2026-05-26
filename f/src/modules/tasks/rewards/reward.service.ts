import { prisma } from "@core/db/prisma";

/**
 * 💰 Reward Engine
 *
 * Architecture:
 * Task → Reward → AirdropParticipant
 *
 * Responsibilities:
 * - Grant task points
 * - Update participant points
 * - Mark participant as dirty
 * - Prevent double rewards
 *
 * NO:
 * - Merkle generation
 * - Allocation calculation
 * - Blockchain calls
 * - Contract sync
 */

export interface RewardResult {
  success: boolean;
  points: number;
  totalPoints: number;
}

export const distributeReward = async (
  userId: string,
  taskId: string
): Promise<RewardResult> => {
  return prisma.$transaction(async (tx) => {
    const userTask =
      await tx.userTask.findUnique({
        where: {
          userId_taskId: {
            userId,
            taskId,
          },
        },
        include: {
          task: true,
        },
      });

    if (!userTask) {
      throw new Error("Task record not found");
    }

    if (userTask.status !== "VERIFIED") {
      throw new Error("Task is not verified");
    }

    if (userTask.rewardGiven) {
      throw new Error("Reward already distributed");
    }

    const participant =
      await tx.airdropParticipant.upsert({
        where: {
          userId,
        },

        update: {},

        create: {
          userId,
          points: 0,
          allocationWei: "0",
          isEligible: true,
          airdropDirty: false,
        },
      });

    const totalPoints =
      participant.points +
      userTask.task.points;

    await tx.airdropParticipant.update({
      where: {
        id: participant.id,
      },

      data: {
        points: totalPoints,

        airdropDirty: true,

        lastCalculatedAt: null,
      },
    });

    await tx.userTask.update({
      where: {
        id: userTask.id,
      },

      data: {
        rewardGiven: true,
      },
    });

    return {
      success: true,
      points: userTask.task.points,
      totalPoints,
    };
  });
};

export const isRewardGiven = async (
  userId: string,
  taskId: string
): Promise<boolean> => {
  const userTask =
    await prisma.userTask.findUnique({
      where: {
        userId_taskId: {
          userId,
          taskId,
        },
      },

      select: {
        rewardGiven: true,
      },
    });

  return userTask?.rewardGiven ?? false;
};

export const getUserRewardState = async (
  userId: string
) => {
  const participant =
    await prisma.airdropParticipant.findUnique({
      where: {
        userId,
      },

      select: {
        points: true,
        allocationWei: true,
        isEligible: true,
        airdropDirty: true,
        lastCalculatedAt: true,
      },
    });

  return (
    participant || {
      points: 0,
      allocationWei: "0",
      isEligible: false,
      airdropDirty: false,
      lastCalculatedAt: null,
    }
  );
};