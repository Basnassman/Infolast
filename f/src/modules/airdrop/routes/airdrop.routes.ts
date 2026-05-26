import { Router } from "express";

import {
  authenticateWallet,
} from "../../../core/middleware/auth.middleware";

import {
  walletRateLimit,
} from "../../../core/middleware/rate-limit.middleware";

import {
  validateRequest,
} from "../../../core/middleware/validate-request.middleware";

import {
  asyncHandler,
} from "../../../core/utils/async-handler";

import {
  checkEligibility,
  getProof,
  claimAirdrop,
  getClaimStatus,
  getAirdropStats,
} from "../controllers/airdrop.controller";

import {
  eligibilitySchema,
} from "../dto/eligibility.dto";

import {
  proofSchema,
} from "../dto/proof.dto";

import {
  claimAirdropSchema,
} from "../dto/claim-airdrop.dto";

const router = Router();

/**
 * GET /airdrop/eligibility
 */
router.get(
  "/eligibility",

  walletRateLimit,

  validateRequest(
    eligibilitySchema
  ),

  asyncHandler(
    checkEligibility
  )
);

/**
 * GET /airdrop/proof
 */
router.get(
  "/proof",

  walletRateLimit,

  validateRequest(
    proofSchema
  ),

  asyncHandler(
    getProof
  )
);

/**
 * GET /airdrop/claim-status
 */
router.get(
  "/claim-status",

  walletRateLimit,

  validateRequest(
    eligibilitySchema
  ),

  asyncHandler(
    getClaimStatus
  )
);

/**
 * POST /airdrop/claim
 */
router.post(
  "/claim",

  authenticateWallet,

  validateRequest(
    claimAirdropSchema
  ),

  asyncHandler(
    claimAirdrop
  )
);

/**
 * GET /airdrop/stats
 */
router.get(
  "/stats",

  walletRateLimit,

  asyncHandler(
    getAirdropStats
  )
);

export default router;