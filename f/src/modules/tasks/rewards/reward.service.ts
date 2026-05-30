import { prisma } from "@core/db/prisma";
import { UserStatus, TaskStatus } from "@prisma/client";
import { userTaskRepository } from "@modules/tasks/repositories/user-task.repository";

export interface RewardResult {
  success: boolean;
  points: number;
  totalPoints: number;
}

export const distributeReward = async (
  userId: string,
  taskId: string,
  points: number
): Promise<RewardResult> => {
  return prisma.$transaction(async (tx) => {
    // ✅ Source of Truth: UserTask (not UserAuditLog)
    const userTask = await tx.userTask.findFirst({
      where: {
        userId,
        taskId,
        status: TaskStatus.VERIFIED,
      },
    });

    if (!userTask) {
      throw new Error("Verified UserTask not found");
    }

    if (userTask.rewardGiven) {
      throw new Error("Reward already distributed");
    }

    // Find or create participant
    let participant = await tx.airdropParticipant.findUnique({
      where: { userId },
    });

    let totalPoints: number;

    if (participant) {
      totalPoints = participant.points + points;

      await tx.airdropParticipant.update({
        where: { id: participant.id },
        data: {
          points: totalPoints,
          airdropDirty: true,
          lastCalculatedAt: null,
        },
      });
    } else {
      totalPoints = points;

      await tx.airdropParticipant.create({
        data: {
          userId,
          points: totalPoints,
          allocationWei: "0",
          isEligible: true,
          airdropDirty: true,
        },
      });
    }

    // Mark UserTask as rewarded
    await tx.userTask.update({
      where: { id: userTask.id },
      data: {
        rewardGiven: true,
        points,
      },
    });

    return {
      success: true,
      points,
      totalPoints,
    };
  });
};

export const isRewardGiven = async (
  userId: string,
  taskId: string
): Promise<boolean> => {
  const userTask = await prisma.userTask.findFirst({
    where: {
      userId,
      taskId,
      rewardGiven: true,
    },
  });

  return !!userTask;
};

export const getUserRewardState = async (userId: string) => {
  const participant = await prisma.airdropParticipant.findUnique({
    where: { userId },
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
