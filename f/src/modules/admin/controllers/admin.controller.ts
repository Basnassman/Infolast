import { Request, Response } from "express";
import { asyncHandler } from "@core/utils/async-handler";
import { successResponse } from "@core/api/responses/success.response";
import { normalizeMerkleRoot } from "@core/api/normalizers/merkle.normalizer";
import { normalizeTask } from "@modules/tasks/normalizers/task.normalizer";
import { rebuildAndSync } from "@modules/airdrop/workers/rebuild.worker";
import { getActiveMerkleRoot } from "@modules/airdrop/repositories/merkle-root.repository";
import {
  getMerkleJobs,
  createTask,
  updateTask,
  deleteTask,
  getAllTasks,
  toggleTask,
  approveTask,
  rejectTask,
  getReviewQueue,
} from "../services/admin.service";

// ═══════════════════════════════════════════════════════════════════════════
// MERKLE CONTROLLERS (الموجودة حالياً)
// ═══════════════════════════════════════════════════════════════════════════

export const rebuildMerkleController = asyncHandler(
  async (_req: Request, res: Response) => {
    const result = await rebuildAndSync();
    return successResponse(res, result);
  }
);

export const getLatestRootController = asyncHandler(
  async (_req: Request, res: Response) => {
    const root = await getActiveMerkleRoot();
    return successResponse(res, root);
  }
);

export const getMerkleJobsController = asyncHandler(
  async (_req: Request, res: Response) => {
    const jobs = await getMerkleJobs();
    return successResponse(res, jobs);
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// TASK ADMIN CONTROLLERS (الجديدة)
// ═══════════════════════════════════════════════════════════════════════════

export const createTaskController = asyncHandler(
  async (req: Request, res: Response) => {
    const task = await createTask(req.body);
    return successResponse(res, normalizeTask(task));
  }
);

export const updateTaskController = asyncHandler(
  async (req: Request, res: Response) => {
    const task = await updateTask(req.params.id, req.body);
    return successResponse(res, normalizeTask(task));
  }
);

export const deleteTaskController = asyncHandler(
  async (req: Request, res: Response) => {
    const task = await deleteTask(req.params.id);
    return successResponse(res, { deleted: true, task: normalizeTask(task) });
  }
);

export const getAllTasksController = asyncHandler(
  async (_req: Request, res: Response) => {
    const tasks = await getAllTasks();
    return successResponse(res, tasks.map(normalizeTask));
  }
);

export const toggleTaskController = asyncHandler(
  async (req: Request, res: Response) => {
    const task = await toggleTask(req.params.id);
    return successResponse(res, normalizeTask(task));
  }
);

export const approveTaskController = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await approveTask(req.params.id, req.walletAddress || "ADMIN");
    return successResponse(res, result);
  }
);

export const rejectTaskController = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await rejectTask(req.params.id, req.walletAddress || "ADMIN");
    return successResponse(res, result);
  }
);

export const getReviewQueueController = asyncHandler(
  async (_req: Request, res: Response) => {
    const queue = await getReviewQueue();
    return successResponse(res, queue);
  }
);
