import * as riskEngine from "../../user/risk/risk-engine.service";
import * as verificationBot from "../verification/task-verification.bot";
import * as rewardEngine from "../rewards/reward.service";
import * as fraudDetector from "../../user/fraud/fraud-detector.service";
import { prisma } from "../../../core/db/prisma";
import { UserTaskStatus } from "@prisma/client";

/**
 * ⚙️ Task Worker (Refactored)
 * 
 * Responsible ONLY for:
 * - Task verification
 * - Risk analysis
 * - Status updates
 * - Reward trigger (DB only)
 * 
 * REMOVED:
 * - processAirdrop calls
 * - Blockchain logic
 * - Merkle tree building
 * - Direct contract interactions
 * 
 * Architecture:
 * Task Worker → DB Points → Merkle Worker (separate batch)
 */

export interface TaskExecutionResult {
  status: UserTaskStatus;
  riskScore: number;
  verified: boolean;
  rewardGiven?: boolean;
  points?: number;
}

/**
 * Process task execution
 * Pure off-chain operation
 */
export const processTaskExecution = async (
  userId: string,
  taskId: string,
  ip: string,
  userAgent?: string,
  proof?: any
): Promise<TaskExecutionResult> => {
  // 1. Fetch user and task
  const [userRecord, taskRecord] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.task.findUnique({ where: { id: taskId } }),
  ]);

  if (!userRecord || !taskRecord) {
    throw new Error("User or Task not found");
  }

  // 2. Check for existing completion
  const existingTask = await prisma.userTask.findUnique({
    where: { userId_taskId: { userId, taskId } },
  });

  if (existingTask?.rewardGiven) {
    return { status: UserTaskStatus.VERIFIED, riskScore: 0, verified: true };
  }

  // 3. Risk Analysis
  const riskResult = await riskEngine.analyzeRisk(userId, ip, userAgent);

  await prisma.riskLog.create({
    data: {
      userId,
      taskId,
      score: riskResult.score,
      reason: riskResult.reasons.join(", "),
      ip,
      userAgent,
      action: riskResult.action,
    },
  });

  if (riskResult.action === "REJECT") {
    throw new Error("Task rejected by Risk Engine");
  }

  // 4. Verification (actual verification)
  const isVerified = await verificationBot.verifyTaskExecution(
    taskRecord,
    proof
  );

  // 5. Determine final status
  let finalStatus: UserTaskStatus;

  if (riskResult.action === "REVIEW") {
    finalStatus = UserTaskStatus.REVIEW;
  } else if (isVerified) {
    finalStatus = UserTaskStatus.VERIFIED;
  } else {
    finalStatus = UserTaskStatus.REVIEW;
  }

  // 6. Save/update task record
  const userTask = await prisma.userTask.upsert({
    where: { userId_taskId: { userId, taskId } },
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
      ip,
      userAgent,
      metadata: proof ?? {},
      rewardGiven: false,
      completedAt: new Date(),
    },
  });

  // 7. Distribute reward ONLY if VERIFIED and not already given
  let rewardResult;
  if (finalStatus === UserTaskStatus.VERIFIED && !userTask.rewardGiven) {
    rewardResult = await rewardEngine.distributeReward(userId, taskId);
  }

  // 8. Fraud analysis (async, non-blocking)
  fraudDetector.analyzeFraudPatterns(userId).catch(console.error);

  return {
    status: finalStatus,
    riskScore: riskResult.score,
    verified: isVerified,
    rewardGiven: rewardResult?.success,
    points: rewardResult?.points,
  };
};

/**
 * Process review approval (admin action)
 */
export const processReviewApproval = async (
  userTaskId: string
): Promise<TaskExecutionResult> => {
  const userTask = await prisma.userTask.findUnique({
    where: { id: userTaskId },
    include: { task: true },
  });

  if (!userTask) {
    throw new Error("User task not found");
  }

  if (userTask.status !== UserTaskStatus.REVIEW) {
    throw new Error("Task is not in review status");
  }

  // Update to verified
  await prisma.userTask.update({
    where: { id: userTaskId },
    data: { status: UserTaskStatus.VERIFIED },
  });

  // Distribute reward
  const rewardResult = await rewardEngine.distributeReward(
    userTask.userId,
    userTask.taskId
  );

  return {
    status: UserTaskStatus.VERIFIED,
    riskScore: 0,
    verified: true,
    rewardGiven: rewardResult.success,
    points: rewardResult.points,
  };
};