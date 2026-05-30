import { Request, Response } from "express";
import { asyncHandler } from "@core/utils/async-handler";
import { successResponse } from "@core/api/responses/success.response";
import { normalizeClaim } from "@core/api/normalizers/claim.normalizer";
import { normalizeMerkleProof, normalizeMerkleRoot } from "@core/api/normalizers/merkle.normalizer";
import { normalizeParticipant } from "@core/api/normalizers/participant.normalizer";
import { getAirdropStats } from "@modules/airdrop/services/airdrop.service";
import { recordClaim, getClaimStatus } from "@modules/airdrop/services/claim.service";
import { getWalletProof } from "@modules/airdrop/repositories/merkle-proof.repository";

// ─── Eligibility ────────────────────────────────────────────────────────────
export const getEligibilityController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const walletAddress = String(req.query.walletAddress || req.params.walletAddress);
    const eligibility = await getClaimStatus(walletAddress);
    
    // ✅ التأكد من أنه object
    const result = {
      eligible: eligibility.eligible || false,
      amountWei: eligibility.amountWei || "0",
      points: eligibility.points || 0,
      proof: eligibility.proof || [],
      claims: eligibility.claims || [],
      walletAddress: walletAddress.toLowerCase(),
    };
    
    return successResponse(res, normalizeParticipant(result));
  }
);

// ─── Claim ──────────────────────────────────────────────────────────────────
export const claimAirdropController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { walletAddress, txHash } = req.body;
    const claim = await recordClaim(walletAddress, txHash);
    return successResponse(res, normalizeClaim(claim));
  }
);

// ─── Claim Status ───────────────────────────────────────────────────────────
export const getClaimStatusController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const walletAddress = String(req.query.walletAddress || req.params.walletAddress);
    const status = await getClaimStatus(walletAddress);
    return successResponse(res, normalizeClaim(status));
  }
);

// ─── Merkle Proof ───────────────────────────────────────────────────────────
export const getMerkleProofController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const walletAddress = String(req.query.walletAddress);
    const proof = await getWalletProof(walletAddress);
    return successResponse(res, normalizeMerkleProof(proof));
  }
);

// ─── Airdrop Stats ────────────────────────────────────────────────────────
export const getAirdropStatsController = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    const stats = await getAirdropStats();
    return successResponse(res, normalizeMerkleRoot(stats));
  }
);

// ─── Aliases ────────────────────────────────────────────────────────────────
export const checkEligibility = getEligibilityController;
export const getProof = getMerkleProofController;
export const claimAirdrop = claimAirdropController;
export const getClaimStatusHandler = getClaimStatusController; // ✅ تغيير الاسم
export const getAirdropStatsHandler = getAirdropStatsController; // ✅ تغيير الاسم
