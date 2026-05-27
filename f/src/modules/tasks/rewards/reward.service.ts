import { prisma } from "@core/db/prisma";
import { UserStatus } from "@prisma/client";

export interface RewardResult {
  success: boolean;
  points: number;
  totalPoints: number;
}

export const distributeReward = async (
  userId: string,
  taskId: string,
  points: number = 10 // ✅ إضافة: نقاط المهمة
): Promise<RewardResult> => {
  return prisma.$transaction(async (tx) => {
    // ✅ إصلاح: التحقق من UserAuditLog بدلاً من UserTask
    const auditLog = await tx.userAuditLog.findFirst({
      where: {
        userId,
        action: `TASK_SUBMIT:${taskId}`,
      },
    });

    if (!auditLog) {
      throw new Error("Task record not found");
    }

    const metadata = auditLog.metadata as any;
    if (metadata?.status !== "VERIFIED") {
      throw new Error("Task is not verified");
    }

    if (metadata?.rewardGiven) {
      throw new Error("Reward already distributed");
    }

    // ✅ إصلاح: البحث عن participant بـ userId (ليس unique لكن relation)
    const participant = await tx.airdropParticipant.findUnique({
      where: { userId }, // ✅ userId @unique في AirdropParticipant
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
      // ✅ إنشاء participant جديد
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

    // ✅ إصلاح: تحديث الـ AuditLog
    await tx.userAuditLog.update({
      where: { id: auditLog.id },
      data: {
        metadata: {
          ...metadata,
          rewardGiven: true,
          points,
        },
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
  const auditLog = await prisma.userAuditLog.findFirst({
    where: {
      userId,
      action: `TASK_SUBMIT:${taskId}`,
    },
    select: { metadata: true },
  });

  const metadata = auditLog?.metadata as any;
  return metadata?.rewardGiven ?? false;
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
