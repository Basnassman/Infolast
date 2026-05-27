// src/modules/airdrop/controllers/airdrop.controller.ts

import {
  Request,
  Response,
} from "express";

import {
  asyncHandler,
} from "@core/utils/async-handler";

import {
  successResponse,
} from "@core/api/responses/success.response";

import {
  normalizeClaim,
} from "@core/api/normalizers/claim.normalizer";

import {
  normalizeMerkleProof,
  normalizeMerkleRoot,
} from "@core/api/normalizers/merkle.normalizer";

import {
  normalizeParticipant,
} from "@core/api/normalizers/participant.normalizer";

import {
  getAirdropEligibility,
  getAirdropStats,
} from "@modules/airdrop/services/airdrop.service";

import {
  claimAirdrop as claimAirdropTransaction,
  getClaimStatus as getClaimStatusByWallet,
} from "@modules/airdrop/services/claim.service";

import {
  getMerkleProofByWallet,
} from "@modules/airdrop/repositories/merkle-proof.repository";

export const getEligibilityController =
  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {
      const walletAddress =
        String(
          req.params.walletAddress
        );

      const eligibility =
        await getAirdropEligibility(
          walletAddress
        );

      return successResponse(
        res,
        normalizeParticipant(
          eligibility
        )
      );
    }
  );

export const claimAirdropController =
  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {
      const claim =
        await claimAirdropTransaction(
          req.body
        );

      return successResponse(
        res,
        normalizeClaim(claim)
      );
    }
  );

export const getClaimStatusController =
  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {
      const walletAddress =
        String(
          req.params.walletAddress
        );

      const status =
        await getClaimStatusByWallet(
          walletAddress
        );

      return successResponse(
        res,
        normalizeClaim(status)
      );
    }
  );

export const getMerkleProofController =
  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {
      const walletAddress =
        String(
          req.query.walletAddress
        );

      const proof =
        await getMerkleProofByWallet(
          walletAddress
        );

      return successResponse(
        res,
        normalizeMerkleProof(
          proof
        )
      );
    }
  );

export const getAirdropStatsController =
  asyncHandler(
    async (
      _req: Request,
      res: Response
    ) => {
      const stats =
        await getAirdropStats();

      return successResponse(
        res,
        normalizeMerkleRoot(
          stats
        )
      );
    }
  );

export const checkEligibility =
  getEligibilityController;

export const getProof =
  getMerkleProofController;

export const claimAirdrop =
  claimAirdropController;

export const getClaimStatus =
  getClaimStatusController;

export const getAirdropStats =
  getAirdropStatsController;