import { Request, Response } from "express";
import { asyncHandler } from "@core/utils/async-handler";
import { successResponse } from "@core/api/responses/success.response";
import { normalizeClaim } from "@core/api/normalizers/claim.normalizer";
import { normalizeMerkleProof, normalizeMerkleRoot } from "@core/api/normalizers/merkle.normalizer";
import { normalizeParticipant } from "@core/api/normalizers/participant.normalizer";
import { getAirdropStats } from "@modules/airdrop/services/airdrop.service";
import { recordClaim, getClaimStatus } from "@modules/airdrop/services/claim.service";
import { getWalletProof } from "@modules/airdrop/repositories/merkle-proof.repository";
import { ClaimStatusResult, AirdropStatsResult, EligibilityResponse } from "@modules/airdrop/types/airdrop.types";

// ─── Eligibility ────────────────────────────────────────────────────────────
export const getEligibilityController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const walletAddress = String(req.query.walletAddress || req.params.walletAddress);
    const eligibility: ClaimStatusResult = await getClaimStatus(walletAddress);
    
    const result: EligibilityResponse = {
      walletAddress: walletAddress.toLowerCase(),
      eligible: eligibility.eligible,
      amountWei: eligibility.amountWei,
      points: eligibility.points,
      proof: eligibility.proof,
      claims: eligibility.claims,
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
    const status: ClaimStatusResult = await getClaimStatus(walletAddress);
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
    const stats: AirdropStatsResult = await getAirdropStats();
    return successResponse(res, normalizeMerkleRoot(stats));
  }
);

// ─── Aliases ────────────────────────────────────────────────────────────────
export const checkEligibility = getEligibilityController;
export const getProof = getMerkleProofController;
export const claimAirdrop = claimAirdropController;
export const getClaimStatusHandler = getClaimStatusController;
export const getAirdropStatsHandler = getAirdropStatsController;
