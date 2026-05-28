// src/modules/tasks/controllers/task.controller.ts

import { Request, Response } from "express";
import { asyncHandler } from "@core/utils/async-handler";
import { successResponse } from "@core/api/responses/success.response";
import { normalizeTask, normalizeTaskSubmission } from "../normalizers/task.normalizer";
import {
  getAvailableTasks,
  submitTask,
  getUserTaskHistory,
} from "../services/task.service";

// ✅ إزالة asyncHandler من هنا
export const getTasksController = async (req: Request, res: Response) => {
  const walletAddress = String(req.query.walletAddress);
  const tasks = await getAvailableTasks(walletAddress);
  return successResponse(res, tasks.map(normalizeTask));
};

export const submitTaskController = async (req: Request, res: Response) => {
  const result = await submitTask(req.body);
  return successResponse(res, normalizeTaskSubmission(result));
};

export const getTaskHistoryController = async (req: Request, res: Response) => {
  const walletAddress = String(req.params.walletAddress);
  const history = await getUserTaskHistory(walletAddress);
  return successResponse(res, history.map(normalizeTaskSubmission));
};
