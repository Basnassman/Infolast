import { Router } from "express";
import { vestingController } from "@modules/vesting/controllers/vesting.controller";
import { authenticate } from "@core/middleware/auth.middleware";
import { requireAdmin } from "@core/middleware/role.middleware";

/**
 * =====================================================
 * VESTING ROUTES
 * =====================================================
 *
 * Mounted at /api/v1/vesting
 *
 * Public:
 *   POST /claim              — Record claim from frontend (fallback)
 *   GET  /status/:wallet     — Get participant profile
 *
 * Admin (wallet signature + ADMIN role):
 *   GET  /analytics          — Get vesting analytics
 *   GET  /claims/recent      — Get recent claim events
 *   POST /sync               — Trigger manual event sync
 */

const router = Router();

// ─── Public ─────────────────────────────────────────────────────────────────

// Frontend: Record vesting claim after successful on-chain claim
router.post("/claim", vestingController.claimVesting);

// Get vesting status for a wallet
router.get("/status/:wallet", vestingController.vestingStatus);

// ─── Admin ──────────────────────────────────────────────────────────────────

// Get vesting analytics
router.get("/analytics", authenticate, requireAdmin, vestingController.vestingAnalytics);

// Get recent claims
router.get("/claims/recent", authenticate, requireAdmin, vestingController.recentClaims);

// Trigger manual sync
router.post("/sync", authenticate, requireAdmin, vestingController.triggerSync);

export default router;
