import { Router } from "express";
import { walletRateLimit } from "@core/middleware/rate-limit.middleware";
import { validateRequest, validateQuery } from "@core/middleware/validate-request.middleware";
import { asyncHandler } from "@core/utils/async-handler";
import {
  getTasksController,
  submitTaskController,
  getTaskHistoryController,
} from "@modules/tasks/controllers/task.controller";
import { submitTaskSchema } from "../dto/submit-task.dto";
import { walletQuerySchema } from "../dto/wallet-query.dto";

const router = Router();

router.get("/", walletRateLimit, validateQuery(walletQuerySchema), asyncHandler(getTasksController));

router.get("/me", walletRateLimit, validateQuery(walletQuerySchema), asyncHandler(getTaskHistoryController));

router.post(
  "/submit",
  walletRateLimit,
  validateRequest(submitTaskSchema),
  asyncHandler(submitTaskController)
);

export default router;
