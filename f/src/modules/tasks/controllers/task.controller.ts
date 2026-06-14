import { Request, Response } from "express";
import { asyncHandler } from "@core/utils/async-handler";
import { successResponse } from "@core/api/responses/success.response";
import { normalizeTask, normalizeTaskSubmission, normalizeUserTask } from "@core/api/normalizers/task.normalizer";
import { taskService } from "../services/task.service";

export const getTasksController = asyncHandler(async (req: Request, res: Response) => {
  const walletAddress = (req.query.walletAddress as string);
  const tasks = await taskService.getAvailableTasks(walletAddress);
  return successResponse(res, tasks.map(normalizeTask));
});

export const submitTaskController = asyncHandler(async (req: Request, res: Response) => {
  const result = await taskService.submitTask({
    walletAddress: req.body.walletAddress,
    taskId: req.body.taskId,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
    proof: req.body.proof,
  });
  return successResponse(res, normalizeTaskSubmission(result));
});

export const getTaskHistoryController = asyncHandler(async (req: Request, res: Response) => {
  const walletAddress = (req.query.walletAddress as string) || (req.walletAddress as string) || "";
  if (!walletAddress) {
    return successResponse(res, []);
  }
  const history = await taskService.getUserTaskHistory(walletAddress);
  return successResponse(res, history.map(normalizeUserTask));
});