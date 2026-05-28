// src/modules/airdrop/controllers/airdrop.controller.ts

import { Request, Response } from "express";
import { asyncHandler } from "@core/utils/async-handler";
import { successResponse } from "@core/api/responses/success.response";

import {
  getAirdropEligibility,
  getAirdropStats,
} from "@modules/airdrop/services/airdrop.service";

import {
  recordClaim,
  getClaimStatus,
} from "@modules/airdrop/services/claim.service";

import {
  getWalletProof,
} from "@modules/airdrop/repositories/merkle-proof.repository";

export const getEligibilityController = asyncHandler(
  async (req: Request, res: Response) => {
    const walletAddress = String(req.query.walletAddress || req.params.walletAddress);
    const eligibility = await getAirdropEligibility(walletAddress);

    // ✅ إرجاع مباشر بدلاً من normalizeParticipant
    return successResponse(res, {
      eligible: eligibility.eligible,
      amountWei: eligibility.amountWei,
      proof: eligibility.proof,
      claims: eligibility.claims,
    });
  }
);

export const claimAirdropController = asyncHandler(
  async (req: Request, res: Response) => {
    const { walletAddress, txHash } = req.body;
    const claim = await recordClaim(walletAddress, txHash);

    return successResponse(res, {
      id: claim.id,
      userId: claim.userId,
      amountWei: claim.amountWei,
      status: claim.status,
      txHash: claim.txHash,
      createdAt: claim.createdAt,
    });
  }
);

export const getClaimStatusController = asyncHandler(
  async (req: Request, res: Response) => {
    const walletAddress = String(req.query.walletAddress || req.params.walletAddress);
    const status = await getClaimStatus(walletAddress);

    return successResponse(res, {
      eligible: status.eligible,
      amountWei: status.amountWei,
      proof: status.proof,
      claims: status.claims,
    });
  }
);

export const getMerkleProofController = asyncHandler(
  async (req: Request, res: Response) => {
    const walletAddress = String(req.query.walletAddress);
    const proof = await getWalletProof(walletAddress);

    // ✅ التحقق من وجود proof
    if (!proof) {
      return successResponse(res, null);
    }

    return successResponse(res, {
      walletAddress: proof.walletAddress,
      amountWei: proof.amountWei,
      leaf: proof.leaf,
      merkleRoot: proof.merkleRoot,
    });
  }
);

export const getAirdropStatsController = asyncHandler(
  async (_req: Request, res: Response) => {
    const stats = await getAirdropStats();

    return successResponse(res, {
      totalUsers: stats.totalUsers,
      participants: stats.participants,
      claims: stats.claims,
      activeRoot: stats.activeRoot,
      eligibleCount: stats.eligibleCount,
      totalAmountWei: stats.totalAmountWei,
    });
  }
);

export const checkEligibility = getEligibilityController;
export const getProof = getMerkleProofController;
export const claimAirdrop = claimAirdropController;
export const getClaimStatus = getClaimStatusController;
export const getAirdropStats = getAirdropStatsController;
