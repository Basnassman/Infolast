import { Router, Request, Response, NextFunction } from "express";
import { adminController } from "../controllers/admin.controller";

const router = Router();

// Simple admin auth middleware (replace with your actual roles middleware)
import { requireGov } from "../middleware/roles";

// ── Tasks ──
router.get("/tasks", requireGov, adminController.listAllTasks);
router.post("/tasks", requireGov, adminController.createTask);
router.put("/tasks/:id", requireGov, adminController.updateTask);
router.delete("/tasks/:id", requireGov, adminController.deleteTask);
router.post("/tasks/:id/toggle", requireGov, adminController.toggleTask);

// ── User Tasks ──
router.get("/user-tasks", requireGov, adminController.listUserTasks);
router.post("/user-tasks/:id/verify", requireGov, adminController.verifyUserTask);
router.post("/user-tasks/:id/reject", requireGov, adminController.rejectUserTask);

// ── Review Queue ──
router.get("/review-queue", requireGov, adminController.getReviewQueue);
router.post("/review-queue/:id/approve", requireGov, adminController.approveReview);
router.post("/review-queue/:id/reject", requireGov, adminController.rejectReview);

// ── Dashboard ──
router.get("/dashboard", requireGov, adminController.getDashboardStats);

// ═════════════════════════════════════════════
// 🌳 MERKLE ADMIN ROUTES (NEW)
// ═════════════════════════════════════════════

// Trigger full rebuild + sync
router.post("/rebuild-airdrop", requireGov, adminController.rebuildAirdrop);

// Sync root to contract (or check status)
router.post("/sync-merkle-root", requireGov, adminController.syncMerkleRoot);

// Get current Merkle status
router.get("/merkle-status", requireGov, adminController.getMerkleStatus);

// Get job history
router.get("/merkle-jobs", requireGov, adminController.getMerkleJobs);

export default router;