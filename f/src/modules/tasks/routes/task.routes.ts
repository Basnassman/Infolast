import { Router } from "express";
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

router.get("/", walletRateLimit, asyncHandler(getTasksController));

router.get("/me", walletRateLimit, asyncHandler(getTaskHistoryController));

router.post(
  "/submit",
  walletRateLimit,
  validateRequest(submitTaskSchema),
  asyncHandler(submitTaskController)
);

export default router;
