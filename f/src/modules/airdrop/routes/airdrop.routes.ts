import { Router } from "express";
import { authenticateWallet } from "@core/middleware/auth.middleware";
import { walletRateLimit } from "@core/middleware/rate-limit.middleware";
import { validateRequest } from "@core/middleware/validate-request.middleware";
import { asyncHandler } from "@core/utils/async-handler";

import {
  checkEligibility,
  getProof,
  claimAirdrop,
  getClaimStatusController,  // ✅ الاسم الصحيح
  getAirdropStatsController, // ✅ الاسم الصحيح
} from "@modules/airdrop/controllers/airdrop.controller";

import { eligibilitySchema } from "@modules/airdrop/dto/eligibility.dto";
import { proofRequestSchema } from "@modules/airdrop/dto/proof.dto";
import { claimAirdropSchema } from "@modules/airdrop/dto/claim-airdrop.dto";

const router = Router();

router.get(
  "/eligibility",
  walletRateLimit,
  checkEligibility
);

router.get(
  "/proof",
  walletRateLimit,
  getProof
);

router.get(
  "/claim-status",
  walletRateLimit,
  getClaimStatusController  // ✅ تعديل
);

router.post(
  "/claim",
  authenticateWallet,
  claimAirdrop
);

router.get(
  "/stats",
  walletRateLimit,
  getAirdropStatsController  // ✅ تعديل
);

export default router;
