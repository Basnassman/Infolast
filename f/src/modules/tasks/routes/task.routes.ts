import { Router } from "express";

import {
  authenticateWallet,
} from "@core/middleware/auth.middleware";

import {
  walletRateLimit,
} from "@core/middleware/rate-limit.middleware";

import {
  validateRequest,
} from "@core/middleware/validate-request.middleware";

import {
  asyncHandler,
} from "@core/utils/async-handler";

import {
  getTasksController,
  submitTaskController,
  getTaskHistoryController,
} from "@modules/tasks/controllers/task.controller";

import {
  submitTaskSchema,
} from "../dto/submit-task.dto";

const router = Router();

/**
 * GET /tasks
 */
router.get(
  "/",

  walletRateLimit,

  asyncHandler(
    getTasksController
  )
);

/**
 * GET /tasks/me
 */
router.get(
  "/me",

  authenticateWallet,

  asyncHandler(
    getTaskHistoryController
  )
);

/**
 * POST /tasks/submit
 */
router.post(
  "/submit",

  authenticateWallet,

  validateRequest(
    submitTaskSchema
  ),

  asyncHandler(
    submitTaskController
  )
);

export default router;