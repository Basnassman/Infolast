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
  claimAirdrop,
  getClaimStatus,
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

      return res.json(
        successResponse(
          normalizeParticipant(
            eligibility
          )
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
        await claimAirdrop(
          req.body
        );

      return res.json(
        successResponse(
          normalizeClaim(claim)
        )
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
        await getClaimStatus(
          walletAddress
        );

      return res.json(
        successResponse(
          normalizeClaim(status)
        )
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

      return res.json(
        successResponse(
          normalizeMerkleProof(
            proof
          )
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

      return res.json(
        successResponse(
          normalizeMerkleRoot(
            stats
          )
        )
      );
    }
  );