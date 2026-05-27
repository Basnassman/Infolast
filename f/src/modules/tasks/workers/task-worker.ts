import { prisma } from "@core/db/prisma";
import { UserStatus } from "@prisma/client"; // ✅ استخدام Enum الموجود
import * as riskEngine from "@modules/user/risk/risk-engine.service";
import * as rewardEngine from "@modules/tasks/rewards/reward.service";
import * as fraudDetector from "@modules/user/fraud/fraud-detector.service";

// ✅ إنشاء Enum محلي بدلاً من UserTaskStatus غير الموجود
export enum TaskStatus {
  PENDING = "PENDING",
  VERIFIED = "VERIFIED",
  REVIEW = "REVIEW",
  REJECTED = "REJECTED",
}

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

  if (!user) {
    throw new Error("User not found");
  }

  // ✅ إصلاح: استخدام UserStatus.ACTIVE
  if (user.status !== UserStatus.ACTIVE) {
    throw new Error("User is not active");
  }

  // ✅ إصلاح: استخدام UserAuditLog بدلاً من UserTask
  const existingAudit = await prisma.userAuditLog.findFirst({
    where: {
      userId,
      action: `TASK_SUBMIT:${taskId}`,
    },
  });

  if (existingAudit) {
    return {
      status: TaskStatus.VERIFIED,
      verified: true,
      rewardGiven: true,
      riskScore: 0,
      points: 0,
    };
  }

  const riskResult = await riskEngine.analyzeRisk(userId, ip, userAgent);

  if (riskResult.action === "REJECT") {
    throw new Error("Task rejected by risk engine");
  }

  let finalStatus: TaskStatus =
    riskResult.action === "REVIEW"
      ? TaskStatus.REVIEW
      : TaskStatus.VERIFIED;

  // ✅ إصلاح: استخدام UserAuditLog بدلاً من UserTask
  await prisma.userAuditLog.create({
    data: {
      userId,
      action: `TASK_SUBMIT:${taskId}`,
      metadata: {
        status: finalStatus,
        ip,
        userAgent,
        proof: proof ?? {},
      },
    },
  });

  let rewardResult: any;

  if (finalStatus === TaskStatus.VERIFIED) {
    rewardResult = await rewardEngine.distributeReward(userId, taskId);
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
  userTaskId: string // ⚠️ هذا معرف الـ AuditLog
): Promise<TaskExecutionResult> => {
  // ✅ إصلاح: البحث في UserAuditLog
  const auditLog = await prisma.userAuditLog.findUnique({
    where: { id: userTaskId },
  });

  if (!auditLog) {
    throw new Error("Task record not found");
  }

  const metadata = auditLog.metadata as any;
  if (metadata?.status !== TaskStatus.REVIEW) {
    throw new Error("Task is not under review");
  }

  // ✅ تحديث الـ AuditLog
  await prisma.userAuditLog.update({
    where: { id: auditLog.id },
    data: {
      metadata: {
        ...metadata,
        status: TaskStatus.VERIFIED,
      },
    },
  });

  const rewardResult = await rewardEngine.distributeReward(
    auditLog.userId,
    metadata?.taskId
  );

  return {
    status: TaskStatus.VERIFIED,
    verified: true,
    rewardGiven: rewardResult.success,
    riskScore: 0,
    points: rewardResult.points,
  };
};
