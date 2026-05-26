import { Router } from "express";

import {
  authenticateWallet,
} from "@core/middleware/auth.middleware";

import {
  rateLimit,
} from "@core/middleware/rate-limit.middleware";

import {
  successResponse,
} from "@core/api/responses/success.response";

const router = Router();

/**
 * POST /auth/connect
 * Verify wallet signature
 */
router.post(
  "/connect",

  rateLimit({ windowMs: 60000, maxRequests: 30 }),

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