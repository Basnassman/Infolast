import { Router } from "express";
import { requireAdmin, requireGov } from "@core/middleware/role.middleware";
import { authenticate } from "@core/middleware/auth.middleware";
import { rateLimit } from "@core/middleware/rate-limit.middleware";
import { asyncHandler } from "@core/utils/async-handler";
import { validateRequest } from "@core/middleware/validate-request.middleware";
import {
  rebuildMerkleController,
  getMerkleJobsController,
  getLatestRootController,
  createTaskController,
  updateTaskController,
  deleteTaskController,
  getAllTasksController,
  toggleTaskController,
  approveTaskController,
  rejectTaskController,
  getReviewQueueController,
} from "@modules/admin/controllers/admin.controller";
import { createTaskSchema, updateTaskSchema } from "@modules/tasks/dto/task.dto";

const router = Router();

// ─── Auth Middleware ────────────────────────────────────────────────────────

router.use(rateLimit({ windowMs: 60000, maxRequests: 30 }), authenticate);

// ─── Merkle Routes ──────────────────────────────────────────────────────────

router.get("/stats", requireAdmin, getLatestRootController);
router.get("/merkle/jobs", requireGov, getMerkleJobsController);
router.post("/merkle/rebuild", requireGov, rebuildMerkleController);

// ─── Task Admin Routes ──────────────────────────────────────────────────────

router.post("/tasks", requireAdmin, validateRequest(createTaskSchema), asyncHandler(createTaskController));
router.get("/tasks", requireAdmin, asyncHandler(getAllTasksController));
router.put("/tasks/:id", requireAdmin, validateRequest(updateTaskSchema), asyncHandler(updateTaskController));
router.delete("/tasks/:id", requireAdmin, asyncHandler(deleteTaskController));
router.patch("/tasks/:id/toggle", requireAdmin, asyncHandler(toggleTaskController));
router.get("/review-queue", requireAdmin, asyncHandler(getReviewQueueController));
router.post("/review/:id/approve", requireAdmin, asyncHandler(approveTaskController));
router.post("/review/:id/reject", requireAdmin, asyncHandler(rejectTaskController));

export default router;
