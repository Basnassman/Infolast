import { Request, Response } from "express";
import { prisma } from "../db/prisma";
import { TaskPlatform, TaskCategory, UserTaskStatus } from "@prisma/client";
import * as merkleWorker from "../workers/merkle-worker";
import { getSyncStatus } from "../../src/modules/airdrop/services/contract-sync.service";
import { processReviewApproval } from "../workers/task-worker";

// ─────────────────────────────────────────────
// Audit Log Helper
// ─────────────────────────────────────────────
const auditAction = async (
  action: string,
  userId: string,
  metadata?: any
) => {
  try {
    await prisma.auditLog.create({
      data: {
        action: `ADMIN_${action}`,
        userId,
        metadata: metadata || {},
        ip: "admin-panel",
      },
    });
  } catch (e) {
    console.error("Audit log failed:", e);
  }
};

// ─────────────────────────────────────────────
// Safe helpers
// ─────────────────────────────────────────────
const safeString = (v: any): string | undefined => {
  if (!v) return undefined;
  if (Array.isArray(v)) return v[0];
  return String(v);
};

const safeNumber = (v: any): number | undefined => {
  if (v === undefined || v === null) return undefined;
  if (Array.isArray(v)) v = v[0];
  const n = Number(v);
  return isNaN(n) ? undefined : n;
};

// ═════════════════════════════════════════════
// TASKS
// ═════════════════════════════════════════════

export const listAllTasks = async (req: Request, res: Response) => {
  try {
    const tasks = await prisma.task.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json(tasks);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const createTask = async (req: Request, res: Response) => {
  try {
    const adminWallet = req.wallet;
    if (!adminWallet) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id, title, description, points, platform, category, url } = req.body;

    const task = await prisma.task.create({
      data: {
        id,
        title,
        description: description || null,
        points: Number(points),
        platform: platform as TaskPlatform,
        category: category as TaskCategory,
        url: url || null,
        isActive: true,
      },
    });

    await auditAction("TASK_CREATE", adminWallet, { taskId: id, title });
    res.json({ success: true, task });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};

export const updateTask = async (req: Request, res: Response) => {
  try {
    const adminWallet = req.wallet!;
    const id = safeString(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid id" });

    const { title, description, points, platform, category, url, isActive } = req.body;

    const task = await prisma.task.update({
      where: { id },
      data: {
        title,
        description,
        points: safeNumber(points),
        platform: platform as TaskPlatform,
        category: category as TaskCategory,
        url,
        isActive,
      },
    });

    await auditAction("TASK_UPDATE", adminWallet, { taskId: id });
    res.json({ success: true, task });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};

export const deleteTask = async (req: Request, res: Response) => {
  try {
    const adminWallet = req.wallet!;
    const id = safeString(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid id" });

    const count = await prisma.userTask.count({ where: { taskId: id } });
    if (count > 0) {
      return res.status(400).json({
        error: "Cannot delete task with existing completions",
      });
    }

    await prisma.task.delete({ where: { id } });
    await auditAction("TASK_DELETE", adminWallet, { taskId: id });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};

export const toggleTask = async (req: Request, res: Response) => {
  try {
    const adminWallet = req.wallet!;
    const id = safeString(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid id" });

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) return res.status(404).json({ error: "Task not found" });

    const updated = await prisma.task.update({
      where: { id },
      data: { isActive: !task.isActive },
    });

    await auditAction("TASK_TOGGLE", adminWallet, {
      taskId: id,
      isActive: updated.isActive,
    });
    res.json({ success: true, task: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};

// ═════════════════════════════════════════════
// USER TASKS
// ═════════════════════════════════════════════

export const listUserTasks = async (req: Request, res: Response) => {
  try {
    const status = safeString(req.query.status);
    const wallet = safeString(req.query.wallet);
    const taskId = safeString(req.query.taskId);

    const where: any = {};
    if (status) where.status = status;
    if (taskId) where.taskId = taskId;

    if (wallet) {
      const user = await prisma.user.findUnique({ where: { wallet } });
      if (user) where.userId = user.id;
    }

    const userTasks = await prisma.userTask.findMany({
      where,
      include: {
        user: { select: { wallet: true, id: true } },
        task: { select: { title: true, platform: true, points: true } },
      },
      orderBy: { completedAt: "desc" },
      take: 100,
    });

    res.json(userTasks);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const verifyUserTask = async (req: Request, res: Response) => {
  try {
    const adminWallet = req.wallet!;
    const id = safeString(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid id" });

    const userTask = await prisma.userTask.update({
      where: { id },
      data: { status: UserTaskStatus.VERIFIED },
    });

    await auditAction("USER_TASK_VERIFY", adminWallet, { userTaskId: id });
    res.json({ success: true, userTask });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};

export const rejectUserTask = async (req: Request, res: Response) => {
  try {
    const adminWallet = req.wallet!;
    const id = safeString(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid id" });

    const userTask = await prisma.userTask.update({
      where: { id },
      data: { status: UserTaskStatus.REJECTED },
    });

    await auditAction("USER_TASK_REJECT", adminWallet, { userTaskId: id });
    res.json({ success: true, userTask });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};

// ═════════════════════════════════════════════
// REVIEW QUEUE
// ═════════════════════════════════════════════

export const getReviewQueue = async (req: Request, res: Response) => {
  try {
    const queue = await prisma.userTask.findMany({
      where: { status: UserTaskStatus.REVIEW },
      include: {
        user: { select: { wallet: true, riskScore: true } },
        task: { select: { title: true, platform: true, points: true } },
      },
      orderBy: { completedAt: "desc" },
    });
    res.json(queue);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const approveReview = async (req: Request, res: Response) => {
  try {
    const adminWallet = req.wallet!;
    const id = safeString(req.params.id);

    if (!id) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const result = await processReviewApproval(id);

    await auditAction("REVIEW_APPROVE", adminWallet, {
      userTaskId: id,
    });

    res.json({
      success: true,
      result,
    });
  } catch (err: any) {
    res.status(400).json({
      error: err.message,
    });
  }
};

export const rejectReview = async (req: Request, res: Response) => {
  try {
    const adminWallet = req.wallet!;
    const id = safeString(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid id" });

    const userTask = await prisma.userTask.update({
      where: { id },
      data: { status: UserTaskStatus.REJECTED },
    });

    await auditAction("REVIEW_REJECT", adminWallet, { userTaskId: id });
    res.json({ success: true, userTask });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};

// ═════════════════════════════════════════════
// DASHBOARD
// ═════════════════════════════════════════════

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const [
      totalUsers,
      totalTasks,
      activeTasks,
      totalUserTasks,
      verifiedTasks,
      pendingReviews,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.task.count(),
      prisma.task.count({ where: { isActive: true } }),
      prisma.userTask.count(),
      prisma.userTask.count({ where: { status: UserTaskStatus.VERIFIED } }),
      prisma.userTask.count({ where: { status: UserTaskStatus.REVIEW } }),
    ]);

    res.json({
      totalUsers,
      totalTasks,
      activeTasks,
      totalUserTasks,
      verifiedTasks,
      pendingReviews,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// ═════════════════════════════════════════════
// 🌳 MERKLE ADMIN ENDPOINTS (NEW)
// ═════════════════════════════════════════════

/**
 * POST /admin/rebuild-airdrop
 * Trigger manual Merkle rebuild and sync
 */
export const rebuildAirdrop = async (req: Request, res: Response) => {
  try {
    const adminWallet = req.wallet;
    if (!adminWallet) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Check if already processing
    const existingJob = await prisma.merkleJob.findFirst({
      where: { status: "PROCESSING" },
    });

    if (existingJob) {
      return res.status(409).json({
        error: "Merkle rebuild already in progress",
        jobId: existingJob.id,
      });
    }

    // Trigger rebuild
    const result = await merkleWorker.rebuildAndSync();

    await auditAction("MERKLE_REBUILD", adminWallet, {
      jobId: result.jobId,
      success: result.success,
      root: result.root,
    });

    if (!result.success) {
      return res.status(500).json({
        error: result.error || "Rebuild failed",
        jobId: result.jobId,
      });
    }

    res.json({
      success: true,
      jobId: result.jobId,
      root: result.root,
      txHash: result.txHash,
      eligibleCount: result.eligibleCount,
      totalAmountWei: result.totalAmountWei,
      durationMs: result.durationMs,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /admin/sync-merkle-root
 * Sync current DB root to contract only
 */
export const syncMerkleRoot = async (req: Request, res: Response) => {
  try {
    const adminWallet = req.wallet;
    if (!adminWallet) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { pushToContract } = req.body;
    const syncStatus = await getSyncStatus();

    if (syncStatus.dbRoot === "0x0") {
      return res.status(400).json({ error: "No Merkle root in database" });
    }

    if (pushToContract) {
      const { pushMerkleRootToContract } = await import(
        "../services/merkle-sync.service"
      );
      const txHash =
  await pushMerkleRootToContract(
    syncStatus.dbRoot,
    syncStatus.totalAmountWei
  );

      await auditAction("MERKLE_SYNC", adminWallet, {
        root: syncStatus.dbRoot,
        txHash,
      });

      res.json({
        success: true,
        root: syncStatus.dbRoot,
        txHash,
        message: "Root synced to contract",
      });
    } else {
      res.json({
        success: true,
        root: syncStatus.dbRoot,
        inSync: syncStatus.inSync,
        message: "Root status retrieved",
      });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /admin/merkle-status
 * Get current Merkle sync status
 */
export const getMerkleStatus = async (req: Request, res: Response) => {
  try {
    const syncStatus = await getSyncStatus();
    const latestJob = await merkleWorker.getLatestJobStatus();
    const jobHistory = await merkleWorker.getJobHistory(5);

    res.json({
      current: {
        dbRoot: syncStatus.dbRoot,
        contractRoot: syncStatus.contractRoot,
        inSync: syncStatus.inSync,
        totalEligible: syncStatus.totalEligible,
        totalAmountWei: syncStatus.totalAmountWei,
        status: syncStatus.status,
        lastSyncedAt: syncStatus.lastSyncedAt,
        errorMessage: syncStatus.errorMessage,
      },
      latestJob: latestJob
        ? {
            id: latestJob.id,
            status: latestJob.status,
            root: latestJob.root,
            txHash: latestJob.txHash,
            eligibleCount: latestJob.eligibleCount,
            totalAmountWei: latestJob.totalAmountWei,
            startedAt: latestJob.startedAt,
            completedAt: latestJob.completedAt,
            error: latestJob.error,
          }
        : null,
      jobHistory: jobHistory.map((job) => ({
        id: job.id,
        status: job.status,
        root: job.root,
        eligibleCount: job.eligibleCount,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /admin/merkle-jobs
 * Get full job history with pagination
 */
export const getMerkleJobs = async (req: Request, res: Response) => {
  try {
    const page = safeNumber(req.query.page) || 1;
    const limit = Math.min(safeNumber(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const [jobs, total] = await Promise.all([
      prisma.merkleJob.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.merkleJob.count(),
    ]);

    res.json({
      jobs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// ═════════════════════════════════════════════
// EXPORT
// ═════════════════════════════════════════════
export const adminController = {
  // Tasks
  listAllTasks,
  createTask,
  updateTask,
  deleteTask,
  toggleTask,
  // User Tasks
  listUserTasks,
  verifyUserTask,
  rejectUserTask,
  // Review Queue
  getReviewQueue,
  approveReview,
  rejectReview,
  // Dashboard
  getDashboardStats,
  // Merkle (NEW)
  rebuildAirdrop,
  syncMerkleRoot,
  getMerkleStatus,
  getMerkleJobs,
};