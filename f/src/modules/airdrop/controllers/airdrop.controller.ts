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
// ✅ إزالة: getAirdropEligibility المكررة
// ✅ استخدام: getClaimStatus مباشرة
export const getEligibilityController = asyncHandler(
  async (req: Request, res: Response) => {
    const walletAddress = String(req.query.walletAddress || req.params.walletAddress);
    const eligibility = await getClaimStatus(walletAddress);
    return successResponse(res, normalizeParticipant({
      ...eligibility,
      walletAddress: walletAddress.toLowerCase(),
    }));
  }
);

// ─── Claim ──────────────────────────────────────────────────────────────────
export const claimAirdropController = asyncHandler(
  async (req: Request, res: Response) => {
    const { walletAddress, txHash } = req.body;
    const claim = await recordClaim(walletAddress, txHash);
    return successResponse(res, normalizeClaim(claim));
  }
);

// ─── Claim Status ───────────────────────────────────────────────────────────
export const getClaimStatusController = asyncHandler(
  async (req: Request, res: Response) => {
    const walletAddress = String(req.query.walletAddress || req.params.walletAddress);
    const status = await getClaimStatus(walletAddress);
    return successResponse(res, normalizeClaim(status));
  }
);

// ─── Merkle Proof ───────────────────────────────────────────────────────────
export const getMerkleProofController = asyncHandler(
  async (req: Request, res: Response) => {
    const walletAddress = String(req.query.walletAddress);
    const proof = await getWalletProof(walletAddress);
    return successResponse(res, normalizeMerkleProof(proof));
  }
);

// ─── Airdrop Stats ────────────────────────────────────────────────────────
export const getAirdropStatsController = asyncHandler(
  async (_req: Request, res: Response) => {
    const stats = await getAirdropStats();
    return successResponse(res, normalizeMerkleRoot(stats));
  }
);

// ─── Aliases ────────────────────────────────────────────────────────────────
export const checkEligibility = getEligibilityController;
export const getProof = getMerkleProofController;
export const claimAirdrop = claimAirdropController;
export const getClaimStatus = getClaimStatusController;
export const getAirdropStats = getAirdropStatsController;
