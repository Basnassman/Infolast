import { Router } from "express";

import {
  authenticate,
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

  authenticate,

  async (req, res) => {
    return successResponse(
      res,
      {
        walletAddress:
          req.walletAddress,
      }
    );
  }
);

/**
 * GET /auth/me
 */
router.get(
  "/me",

  authenticate,

  async (req, res) => {
    return successResponse(
      res,
      {
        walletAddress:
          req.walletAddress,
      }
    );
  }
);

export default router;