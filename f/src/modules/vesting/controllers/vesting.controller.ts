import { Request, Response } from "express";
import {
  vestingService,
} from "@modules/vesting/services/vesting.service";
import { syncVestingEvents } from "@modules/vesting/sync/vesting.sync";
import { asyncHandler } from "@core/utils/async-handler";
import { ValidationError } from "@core/api/exceptions/validation.error";
import { validateClaimVesting } from "@modules/vesting/dto/claim-vesting.dto";

/**
 * =====================================================
 * VESTING CONTROLLER
 * =====================================================
 *
 * API endpoints for:
 * - Recording frontend claims (fallback for sync)
 * - Getting participant profiles
 * - Getting analytics (admin)
 * - Triggering manual sync (admin)
 * - Getting recent claims (admin)
 */

/**
 * POST /api/vesting/claim
 *
 * Record a vesting claim from the frontend.
 * Called after the user successfully claims tokens from the contract.
 * This is a fallback — the sync indexer is the primary source.
 *
 * Body: { wallet, txHash, amountWei }
 */
export const claimVesting = asyncHandler(async (req: Request, res: Response) => {
  const { wallet, txHash, amountWei } = validateClaimVesting(req.body);

  const result = await vestingService.recordFrontendClaim(wallet, txHash, amountWei);
  res.json({ success: true, data: result });
});

/**
 * GET /api/vesting/status/:wallet
 *
 * Get vesting participant profile.
 * Returns allocation, claim status, progress, and classification.
 */
export const vestingStatus = asyncHandler(async (req: Request, res: Response) => {
  const wallet = req.params.wallet as string;

  if (!wallet) {
    throw new ValidationError("wallet address is required");
  }

  const profile = await vestingService.getParticipantProfile(wallet);
  res.json({ success: true, data: profile });
});

/**
 * GET /api/vesting/analytics
 *
 * Get vesting analytics for admin dashboard.
 * Returns totals, status breakdown, source breakdown, and classifications.
 */
export const vestingAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const analytics = await vestingService.getAnalytics();
  res.json({ success: true, data: analytics });
});

/**
 * GET /api/vesting/claims/recent
 *
 * Get recent claim events across all participants.
 * Query: ?limit=50 (default 50)
 */
export const recentClaims = asyncHandler(async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const claims = await vestingService.getRecentClaims(limit);
  res.json({ success: true, data: claims });
});

/**
 * POST /api/vesting/sync
 *
 * Trigger a manual vesting event sync.
 * Admin endpoint — indexes Allocated and Claimed events from blockchain.
 */
export const triggerSync = asyncHandler(async (req: Request, res: Response) => {
  const result = await syncVestingEvents();
  res.json({ success: true, data: result });
});

export const vestingController = {
  claimVesting,
  vestingStatus,
  vestingAnalytics,
  recentClaims,
  triggerSync,
};
