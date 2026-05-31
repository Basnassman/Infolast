// f/src/modules/tasks/workers/task-worker.ts

import { prisma } from "@core/db/prisma";
import { UserStatus, TaskStatus } from "@prisma/client";
import * as riskEngine from "@modules/user/risk/risk-engine.service";
import * as rewardEngine from "@modules/tasks/rewards/reward.service";
import * as fraudDetector from "@modules/user/fraud/fraud-detector.service";

export interface TaskExecutionResult {
  status: TaskStatus;
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
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) throw new Error("User not found");
  if (user.status !== UserStatus.ACTIVE) throw new Error("User is not active");

  // ✅ UserTask الصحيح
  const existing = await prisma.userTask.findUnique({
    where: { userId_taskId: { userId, taskId } },
  });

  if (existing) {
    return {
      status: existing.status,
      verified: existing.status === TaskStatus.VERIFIED,
      rewardGiven: existing.rewardGiven,
      riskScore: 0,
      points: existing.points,
    };
  }

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new Error("Task not found");
  if (!task.isActive) throw new Error("Task is not active");

  const submissionCount = await prisma.userTask.count({ where: { taskId } });
  if (submissionCount >= task.maxSubmissions) {
    throw new Error("Task submission limit reached");
  }

  const riskResult = await riskEngine.analyzeRisk(userId, ip, userAgent);

  if (riskResult.action === "REJECT") {
    await prisma.userTask.create({
      data: {
        userId,
        taskId,
        status: TaskStatus.REJECTED,
        ip,
        userAgent,
        proof: proof ?? {},
      },
    });

    return {
      status: TaskStatus.REJECTED,
      verified: false,
      rewardGiven: false,
      riskScore: riskResult.score,
      points: 0,
    };
  }

  const finalStatus = riskResult.action === "REVIEW" ? TaskStatus.REVIEW : TaskStatus.VERIFIED;

  const userTask = await prisma.userTask.create({
    data: {
      userId,
      taskId,
      status: finalStatus,
      ip,
      userAgent,
      proof: proof ?? {},
    },
  });

  let rewardResult: any;

  if (finalStatus === TaskStatus.VERIFIED) {
    rewardResult = await rewardEngine.distributeReward(userId, taskId, task.points);

    if (rewardResult?.success) {
      await prisma.userTask.update({
        where: { id: userTask.id },
        data: {
          rewardGiven: true,
          points: rewardResult.points,
          completedAt: new Date(),
        },
      });
    }
  }

  fraudDetector.analyzeFraudPatterns(userId).catch(console.error);

  return {
    status: finalStatus,
    riskScore: riskResult.score,
    verified: finalStatus === TaskStatus.VERIFIED,
    rewardGiven: rewardResult?.success,
    points: rewardResult?.points,
  };
};

export const processReviewApproval = async (
  userTaskId: string
): Promise<TaskExecutionResult> => {
  const userTask = await prisma.userTask.findUnique({
    where: { id: userTaskId },
    include: { task: true },
  });

  if (!userTask) throw new Error("UserTask not found");
  if (userTask.status !== TaskStatus.REVIEW) throw new Error("Task is not under review");

  await prisma.userTask.update({
    where: { id: userTask.id },
    data: {
      status: TaskStatus.VERIFIED,
      completedAt: new Date(),
    },
  });

  const rewardResult = await rewardEngine.distributeReward(
    userTask.userId,
    userTask.taskId,
    userTask.task.points
  );

  if (rewardResult?.success) {
    await prisma.userTask.update({
      where: { id: userTask.id },
      data: {
        rewardGiven: true,
        points: rewardResult.points,
      },
    });
  }

  return {
    status: TaskStatus.VERIFIED,
    verified: true,
    rewardGiven: rewardResult?.success,
    riskScore: 0,
    points: rewardResult?.points,
  };
};
