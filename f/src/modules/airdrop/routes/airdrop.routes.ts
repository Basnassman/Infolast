import { Router } from "express";
import {
  checkEligibility,
  recordAirdropClaim,
  getStats,
  getClaimStatusHandler,
  getProofHandler,
} from "../controllers/airdrop.controller";

const router = Router();

// ── Eligibility ──
router.get("/eligibility/:wallet", checkEligibility);

// ── Proof ──
router.get("/proof", getProofHandler);

// ── Claim ──
router.post("/claim", recordAirdropClaim);

// ── Status ──
router.get("/claim-status/:wallet", getClaimStatusHandler);

// ── Stats ──
router.get("/stats", getStats);

export default router;