import { Router } from "express";
import { requireAdmin, requireGov, requireAdminOrGov } from "@core/middleware/role.middleware";
import { authenticate } from "@core/middleware/auth.middleware";
import { rateLimit } from "@core/middleware/rate-limit.middleware";
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
router.post("/tasks", requireAdminOrGov, validateRequest(createTaskSchema), createTaskController);
router.get("/tasks", requireAdminOrGov, getAllTasksController);
router.put("/tasks/:id", requireAdminOrGov, validateRequest(updateTaskSchema), updateTaskController);
router.delete("/tasks/:id", requireAdminOrGov, deleteTaskController);
router.patch("/tasks/:id/toggle", requireAdminOrGov, toggleTaskController);
router.get("/review-queue", requireAdminOrGov, getReviewQueueController);
router.post("/review/:id/approve", requireAdminOrGov, approveTaskController);
router.post("/review/:id/reject", requireAdminOrGov, rejectTaskController);

export default router;
