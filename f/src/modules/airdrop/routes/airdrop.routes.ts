import {
  Router,
} from "express";

import {
  checkEligibility,
  getProofHandler,
  recordAirdropClaim,
  getClaimStatusHandler,
  getStats,
} from "../controllers/airdrop.controller";

const router = Router();

router.get(
  "/eligibility/:wallet",
  checkEligibility
);

router.get(
  "/proof",
  getProofHandler
);

router.post(
  "/claim",
  recordAirdropClaim
);

router.get(
  "/claim-status/:wallet",
  getClaimStatusHandler
);

router.get(
  "/stats",
  getStats
);

export default router;
