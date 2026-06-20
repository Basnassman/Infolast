import { Router } from "express";
import { requireAdmin } from "@core/middleware/role.middleware";
import { authenticate } from "@core/middleware/auth.middleware";
import { rateLimit } from "@core/middleware/rate-limit.middleware";
import { asyncHandler } from "@core/utils/async-handler";
import { successResponse } from "@core/api/responses/success.response";
import { purchaseService } from "@modules/purchase/services/purchase.service";
import { syncPurchaseEvents } from "@modules/purchase/sync/purchase.sync";

const router = Router();

// ─── Rate Limit (applies to all routes) ────────────────────────────────────
router.use(rateLimit({ windowMs: 60_000, maxRequests: 30 }));

// ─── Frontend: Record Purchase After Blockchain Confirmation ─────────────────
// No authenticate middleware needed — backend verifies tx on-chain via processFrontendPurchase
router.post(
  "/record",
  asyncHandler(async (req, res) => {
    const { walletAddress, txHash } = req.body;

    if (!walletAddress || !txHash) {
      return res.status(400).json({
        success: false,
        error: { message: "walletAddress and txHash are required" },
      });
    }

    const result = await purchaseService.processFrontendPurchase(
      String(walletAddress),
      String(txHash)
    );

    return successResponse(res, result);
  })
);

// ─── Admin: Purchase Stats ──────────────────────────────────────────────────
router.get(
  "/stats",
  authenticate,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const stats = await purchaseService.getPurchaseStats();
    return successResponse(res, stats);
  })
);

// ─── Admin: Recent Purchases ────────────────────────────────────────────────
router.get(
  "/recent",
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const rawLimit = req.query.limit;
    const limit = Math.min(Number(Array.isArray(rawLimit) ? rawLimit[0] : rawLimit) || 50, 200);
    const purchases = await purchaseService.getRecentPurchases(limit);
    return successResponse(res, purchases);
  })
);

// ─── Admin: Manual Sync Trigger ─────────────────────────────────────────────
router.post(
  "/sync",
  authenticate,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const result = await syncPurchaseEvents();
    return successResponse(res, result);
  })
);

// ─── Admin: Buyer Profile ───────────────────────────────────────────────────
router.get(
  "/buyer/:walletAddress",
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const walletAddress = String(req.params.walletAddress);
    const profile = await purchaseService.getBuyerProfile(walletAddress);
    return successResponse(res, profile);
  })
);

// ─── Admin: User Purchases ──────────────────────────────────────────────────
router.get(
  "/user/:userId",
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const userId = String(req.params.userId);
    const purchases = await purchaseService.getUserPurchases(userId);
    return successResponse(res, purchases);
  })
);

export default router;
