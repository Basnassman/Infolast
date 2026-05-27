import { Router } from "express";
import { authenticateWallet } from "@core/middleware/auth.middleware";
import { walletRateLimit } from "@core/middleware/rate-limit.middleware"; // ✅ موجود!
import { validateRequest } from "@core/middleware/validate-request.middleware"; // ✅ موجود!
import { asyncHandler } from "@core/utils/async-handler"; // ✅ موجود!

import {
  checkEligibility,
  getProof,
  claimAirdrop,
  getClaimStatus,
  getAirdropStats,
} from "@modules/airdrop/controllers/airdrop.controller";

// ⚠️ هذه الملفات غير موجودة في الهيكل - يجب إنشاؤها أو إزالتها
import { eligibilitySchema } from "@modules/airdrop/dto/eligibility.dto";
import { proofSchema } from "@modules/airdrop/dto/proof.dto";
import { claimAirdropSchema } from "@modules/airdrop/dto/claim-airdrop.dto";

const router = Router();

router.get(
  "/eligibility",
  walletRateLimit,
  // validateRequest(eligibilitySchema), // ⚠️ schema غير موجود
  asyncHandler(checkEligibility)
);

router.get(
  "/proof",
  walletRateLimit,
  // validateRequest(proofSchema),
  asyncHandler(getProof)
);

router.get(
  "/claim-status",
  walletRateLimit,
  // validateRequest(eligibilitySchema),
  asyncHandler(getClaimStatus)
);

router.post(
  "/claim",
  authenticateWallet,
  // validateRequest(claimAirdropSchema),
  asyncHandler(claimAirdrop)
);

router.get(
  "/stats",
  walletRateLimit,
  asyncHandler(getAirdropStats)
);

export default router;
