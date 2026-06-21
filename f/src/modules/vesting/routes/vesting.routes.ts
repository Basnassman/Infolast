import { Router } from "express";
import { vestingController } from "@modules/vesting/controllers/vesting.controller";

/**
 * =====================================================
 * VESTING ROUTES
 * =====================================================
 *
 * /api/vesting/*
 *
 * Public:
 *   POST /claim              — Record claim from frontend (fallback)
 *   GET  /status/:wallet     — Get participant profile
 *
 * Admin:
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
router.get("/analytics", vestingController.vestingAnalytics);

// Get recent claims
router.get("/claims/recent", vestingController.recentClaims);

// Trigger manual sync
router.post("/sync", vestingController.triggerSync);

export default router;
