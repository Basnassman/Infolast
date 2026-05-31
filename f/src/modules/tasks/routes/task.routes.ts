// f/src/modules/tasks/routes/task.routes.ts

import { Router } from "express";
import { authenticateWallet } from "@core/middleware/auth.middleware";
import { walletRateLimit } from "@core/middleware/rate-limit.middleware";
import { validateRequest } from "@core/middleware/validate-request.middleware";
import { asyncHandler } from "@core/utils/async-handler";
import {
  getTasksController,
  submitTaskController,
  getTaskHistoryController,
} from "@modules/tasks/controllers/task.controller";
import { submitTaskSchema } from "../dto/submit-task.dto";

const router = Router();

/**
 * GET /tasks - Get all available tasks (public, rate limited)
 */
router.get(
  "/",
  walletRateLimit,
  asyncHandler(getTasksController)  // ← ناقص!
);

/**
 * GET /tasks/me - Get user's task history (authenticated)
 */
router.get(
  "/me",
  authenticateWallet,
  asyncHandler(getTaskHistoryController)  // ← ناقص!
);

/**
 * POST /tasks/submit - Submit a task completion (authenticated)
 */
router.post(
  "/submit",
  authenticateWallet,
  validateRequest(submitTaskSchema),
  asyncHandler(submitTaskController)  // ← ناقص!
);

export default router;
