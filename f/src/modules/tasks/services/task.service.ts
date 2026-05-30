import { Task, TaskStatus, TaskPlatform, TaskType } from "@prisma/client";
import { taskRepository, CreateTaskInput, UpdateTaskInput } from "../repositories/task.repository";
import { userTaskRepository, CreateUserTaskInput } from "../repositories/user-task.repository";
import { userService } from "@modules/user/services/user.service";
import { distributeReward } from "./rewards/reward.service";
import { taskEventEmitter } from "./events/task.events";
import { riskEngine } from "@modules/user/risk/risk-engine.service";
import { fraudDetector } from "@modules/user/fraud/fraud-detector.service";

// ─── Admin Operations ───────────────────────────────────────────────────────

export const createTask = async (data: CreateTaskInput): Promise<Task> => {
  const task = await taskRepository.create(data);
  taskEventEmitter.emit("task.created", { taskId: task.id });
  return task;
};

export const updateTask = async (id: string, data: UpdateTaskInput): Promise<Task> => {
  const task = await taskRepository.update(id, data);
  taskEventEmitter.emit("task.updated", { taskId: task.id });
  return task;
};

export const deleteTask = async (id: string): Promise<Task> => {
  const task = await taskRepository.delete(id);
  taskEventEmitter.emit("task.deleted", { taskId: task.id });
  return task;
};

export const getTasks = async (): Promise<Task[]> => {
  return taskRepository.findAll();
};

export const getActiveTasks = async (): Promise<Task[]> => {
  return taskRepository.findActive();
};

export const toggleTask = async (id: string): Promise<Task> => {
  const task = await taskRepository.toggle(id);
  taskEventEmitter.emit("task.toggled", { taskId: task.id, isActive: task.isActive });
  return task;
};

// ─── User Operations ────────────────────────────────────────────────────────

export const getAvailableTasks = async (walletAddress: string): Promise<Task[]> => {
  const user = await userService.findByWallet(walletAddress);
  if (!user) return [];

  const tasks = await taskRepository.findActive();
  const userTasks = await userTaskRepository.findByUser(user.id);

  const completedTaskIds = new Set(
    userTasks
      .filter((ut) => ut.status === TaskStatus.VERIFIED)
      .map((ut) => ut.taskId)
  );

  // Filter out tasks already completed (respect maxSubmissions)
  return tasks.filter((task) => {
    const submissions = userTasks.filter((ut) => ut.taskId === task.id).length;
    return submissions < task.maxSubmissions;
  });
};

export const getUserTaskHistory = async (walletAddress: string): Promise<any[]> => {
  const user = await userService.findByWallet(walletAddress);
  if (!user) return [];

  const history = await userTaskRepository.findByUser(user.id);
  return history.map((ut) => ({
    id: ut.id,
    userId: ut.userId,
    taskId: ut.taskId,
    status: ut.status,
    rewardGiven: ut.rewardGiven,
    points: ut.points,
    completedAt: ut.completedAt?.toISOString(),
    createdAt: ut.createdAt.toISOString(),
    updatedAt: ut.updatedAt.toISOString(),
    task: ut.task,
  }));
};

// ─── Submit Task ────────────────────────────────────────────────────────────

export interface SubmitTaskPayload {
  walletAddress: string;
  taskId: string;
  ip?: string;
  userAgent?: string;
  proof?: Record<string, any>;
}

export const submitTask = async (payload: SubmitTaskPayload): Promise<any> => {
  const { walletAddress, taskId, ip, userAgent, proof } = payload;

  // Find user
  const user = await userService.findByWallet(walletAddress);
  if (!user) throw new Error("User not found");

  // Find task
  const task = await taskRepository.findById(taskId);
  if (!task) throw new Error("Task not found");
  if (!task.isActive) throw new Error("Task is not active");

  // Check existing submissions
  const existing = await userTaskRepository.findByUserAndTask(user.id, taskId);
  if (existing && existing.status === TaskStatus.VERIFIED) {
    throw new Error("Task already completed");
  }

  // Risk analysis
  const riskResult = await riskEngine.analyzeRisk(user.id, ip, userAgent);

  if (riskResult.action === "REJECT") {
    throw new Error("Task rejected by risk engine");
  }

  const initialStatus: TaskStatus =
    riskResult.action === "REVIEW" ? TaskStatus.REVIEW : TaskStatus.PENDING;

  // Create or update UserTask
  const userTask = await userTaskRepository.upsert(user.id, taskId, {
    status: initialStatus,
    ip,
    userAgent,
    proof,
  });

  // Emit event
  taskEventEmitter.emit("task.submitted", {
    userTaskId: userTask.id,
    userId: user.id,
    taskId,
    status: initialStatus,
  });

  // Auto-approve if low risk
  if (initialStatus === TaskStatus.PENDING && riskResult.score < 30) {
    return approveTask(userTask.id, "SYSTEM_AUTO");
  }

  // Fraud detection (async)
  fraudDetector.analyzeFraudPatterns(user.id).catch(console.error);

  return {
    id: userTask.id,
    status: userTask.status,
    message:
      initialStatus === TaskStatus.REVIEW
        ? "Task under manual review"
        : "Task submitted successfully",
  };
};

// ─── Approve / Reject ───────────────────────────────────────────────────────

export const approveTask = async (
  userTaskId: string,
  reviewedBy: string
): Promise<any> => {
  const userTask = await userTaskRepository.findById(userTaskId);
  if (!userTask) throw new Error("UserTask not found");
  if (userTask.status === TaskStatus.VERIFIED) {
    throw new Error("Task already approved");
  }

  // Update UserTask
  const updated = await userTaskRepository.update(userTaskId, {
    status: TaskStatus.VERIFIED,
    completedAt: new Date(),
    reviewedAt: new Date(),
    reviewedBy,
  });

  // Distribute reward
  const rewardResult = await distributeReward(
    userTask.userId,
    userTask.taskId,
    userTask.task.points
  );

  // Update points
  await userTaskRepository.update(userTaskId, {
    points: rewardResult.points,
    rewardGiven: rewardResult.success,
  });

  // Emit event
  taskEventEmitter.emit("task.approved", {
    userTaskId,
    userId: userTask.userId,
    taskId: userTask.taskId,
    points: rewardResult.points,
  });

  return {
    id: updated.id,
    status: TaskStatus.VERIFIED,
    points: rewardResult.points,
    totalPoints: rewardResult.totalPoints,
    rewardGiven: rewardResult.success,
  };
};

export const rejectTask = async (
  userTaskId: string,
  reviewedBy: string
): Promise<any> => {
  const userTask = await userTaskRepository.findById(userTaskId);
  if (!userTask) throw new Error("UserTask not found");

  const updated = await userTaskRepository.update(userTaskId, {
    status: TaskStatus.REJECTED,
    reviewedAt: new Date(),
    reviewedBy,
  });

  taskEventEmitter.emit("task.rejected", {
    userTaskId,
    userId: userTask.userId,
    taskId: userTask.taskId,
  });

  return {
    id: updated.id,
    status: TaskStatus.REJECTED,
  };
};

// ─── Review Queue ───────────────────────────────────────────────────────────

export const getReviewQueue = async (): Promise<any[]> => {
  const queue = await userTaskRepository.findPendingReview();
  return queue.map((ut) => ({
    id: ut.id,
    user: {
      wallet: ut.user.walletAddress,
      riskScore: ut.user.riskProfile?.riskScore || 0,
    },
    task: {
      title: ut.task.title,
      platform: ut.task.platform,
      points: ut.task.points,
    },
    status: ut.status,
    completedAt: ut.createdAt.toISOString(),
    ip: ut.ip,
    userAgent: ut.userAgent,
  }));
};
