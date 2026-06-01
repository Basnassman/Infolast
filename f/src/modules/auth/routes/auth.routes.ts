import { Router } from "express";
import { authenticate } from "@core/middleware/auth.middleware";
import { rateLimit } from "@core/middleware/rate-limit.middleware";
import { successResponse } from "@core/api/responses/success.response";
import { isAdmin, isGov, isOperator } from "@core/auth/role.service";

const router = Router();

router.post(
  "/connect",
  rateLimit({ windowMs: 60000, maxRequests: 30 }),
  authenticate,
  async (req, res) => {
    return successResponse(res, { walletAddress: req.walletAddress });
  }
);

router.get(
  "/me",
  authenticate,
  async (req, res) => {
    return successResponse(res, { walletAddress: req.walletAddress });
  }
);

router.get(
  "/check-role",
  rateLimit({ windowMs: 60000, maxRequests: 30 }),
  authenticate,
  async (req, res) => {
    try {
      const walletAddress = req.walletAddress!; // ✅ non-null assertion

      const [admin, gov, operator] = await Promise.all([
        isAdmin(walletAddress),
        isGov(walletAddress),
        isOperator(walletAddress),
      ]);

      return successResponse(res, {
        walletAddress,
        isAdmin: admin,
        isGov: gov,
        isOperator: operator,
        isAuthorized: admin || gov || operator,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: {
          code: "ROLE_CHECK_FAILED",
          message: error.message || "Failed to check roles",
        },
      });
    }
  }
);

export default router;
