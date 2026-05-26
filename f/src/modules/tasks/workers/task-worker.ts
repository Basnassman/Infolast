import { prisma } from "@core/db/prisma";

import * as riskEngine from "@modules/user/risk/risk-engine.service";

import * as rewardEngine from "@modules/tasks/rewards/reward.service";

import * as fraudDetector from "@modules/user/fraud/fraud-detector.service";

import { UserTaskStatus } from "@prisma/client";

/**
 * ⚙️ Task Worker
 *
 * Responsibilities:
 * - Validate task execution
 * - Run risk analysis
 * - Store task state
 * - Trigger rewards
 *
 * NO:
 * - Merkle generation
 * - Blockchain logic
 * - Allocation calculations
 */

export interface TaskExecutionResult {
  status: UserTaskStatus;

  riskScore: number;

  verified: boolean;

  rewardGiven?: boolean;

  points?: number;
}

export const processTaskExecution = async (
  userId: string,
  taskId: string,
  ip: string,
  userAgent?: string,
  proof?: any
): Promise<TaskExecutionResult> => {
  const [user, task] =
    await Promise.all([
      prisma.user.findUnique({
        where: {
          id: userId,
        },
      }),

      prisma.task.findUnique({
        where: {
          id: taskId,
        },
      }),
    ]);

  if (!user) {
    throw new Error("User not found");
  }

  if (!task) {
    throw new Error("Task not found");
  }

  if (user.status !== "ACTIVE") {
    throw new Error("User is not active");
  }

  const existingTask =
    await prisma.userTask.findUnique({
      where: {
        userId_taskId: {
          userId,
          taskId,
        },
      },
    });

  if (existingTask?.rewardGiven) {
    return {
      status: UserTaskStatus.VERIFIED,
      verified: true,
      rewardGiven: true,
      riskScore: 0,
      points: task.points,
    };
  }

  const riskResult =
    await riskEngine.analyzeRisk(
      userId,
      ip,
      userAgent
    );

  if (riskResult.action === "REJECT") {
    throw new Error(
      "Task rejected by risk engine"
    );
  }

  let finalStatus: UserTaskStatus;

  if (riskResult.action === "REVIEW") {
    finalStatus =
      UserTaskStatus.REVIEW;
  } else {
    finalStatus =
      UserTaskStatus.VERIFIED;
  }

  const userTask =
    await prisma.userTask.upsert({
      where: {
        userId_taskId: {
          userId,
          taskId,
        },
      },

      update: {
        status: finalStatus,

        ip,

        userAgent,

        metadata: proof ?? {},

        completedAt: new Date(),
      },

      create: {
        userId,

        taskId,

        status: finalStatus,

        rewardGiven: false,

        ip,

        userAgent,

        metadata: proof ?? {},

        completedAt: new Date(),
      },
    });

  let rewardResult:
    | Awaited<
        ReturnType<
          typeof rewardEngine.distributeReward
        >
      >
    | undefined;

  if (
    finalStatus ===
      UserTaskStatus.VERIFIED &&
    !userTask.rewardGiven
  ) {
    rewardResult =
      await rewardEngine.distributeReward(
        userId,
        taskId
      );
  }

  fraudDetector
    .analyzeFraudPatterns(userId)
    .catch(console.error);

  return {
    status: finalStatus,

    riskScore: riskResult.score,

    verified:
      finalStatus ===
      UserTaskStatus.VERIFIED,

    rewardGiven:
      rewardResult?.success,

    points:
      rewardResult?.points,
  };
};

export const processReviewApproval =
  async (
    userTaskId: string
  ): Promise<TaskExecutionResult> => {
    const userTask =
      await prisma.userTask.findUnique({
        where: {
          id: userTaskId,
        },

        include: {
          task: true,
        },
      });

    if (!userTask) {
      throw new Error(
        "Task record not found"
      );
    }

    if (
      userTask.status !==
      UserTaskStatus.REVIEW
    ) {
      throw new Error(
        "Task is not under review"
      );
    }

    await prisma.userTask.update({
      where: {
        id: userTask.id,
      },

      data: {
        status:
          UserTaskStatus.VERIFIED,
      },
    });

    const rewardResult =
      await rewardEngine.distributeReward(
        userTask.userId,
        userTask.taskId
      );

    return {
      status:
        UserTaskStatus.VERIFIED,

      verified: true,

      rewardGiven:
        rewardResult.success,

      riskScore: 0,

      points:
        rewardResult.points,
    };
  };