// src/modules/airdrop/controllers/airdrop.controller.ts

import {
  Request,
  Response,
} from "express";

import {
  asyncHandler,
} from "../../../core/utils/async-handler";

import {
  buildSuccessResponse,
} from "../../../core/responses/success.response";

import {
  normalizeClaim,
} from "../normalizers/claim.normalizer";

import {
  normalizeMerkleProof,
  normalizeMerkleRoot,
} from "../normalizers/merkle.normalizer";

import {
  normalizeParticipant,
} from "../normalizers/participant.normalizer";

import {
  getAirdropEligibility,
  getAirdropStats,
} from "../services/airdrop.service";

import {
  claimAirdrop,
  getClaimStatus,
} from "../services/claim.service";

import {
  getMerkleProofByWallet,
} from "../repositories/merkle-proof.repository";

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
        buildSuccessResponse(
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
        buildSuccessResponse(
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
        buildSuccessResponse(
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
        buildSuccessResponse(
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
        buildSuccessResponse(
          normalizeMerkleRoot(
            stats
          )
        )
      );
    }
  );