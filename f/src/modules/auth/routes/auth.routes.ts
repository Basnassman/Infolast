import { Router } from "express";

import {
  authenticateWallet,
} from "../../../core/middleware/auth.middleware";

import {
  walletRateLimit,
} from "../../../core/middleware/rate-limit.middleware";

import {
  successResponse,
} from "../../../core/responses/success.response";

const router = Router();

/**
 * POST /auth/connect
 * Verify wallet signature
 */
router.post(
  "/connect",

  walletRateLimit,

  authenticateWallet,

  async (req, res) => {
    return res.json(
      successResponse({
        walletAddress:
          req.auth.walletAddress,
      })
    );
  }
);

/**
 * GET /auth/me
 */
router.get(
  "/me",

  authenticateWallet,

  async (req, res) => {
    return res.json(
      successResponse({
        walletAddress:
          req.auth.walletAddress,
      })
    );
  }
);

export default router;