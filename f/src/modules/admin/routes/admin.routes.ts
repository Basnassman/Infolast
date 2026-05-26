import { Router } from "express";

import {
  requireAdmin,
  requireGov,
} from "../../../core/middleware/role.middleware";

import {
  authenticateWallet,
} from "../../../core/middleware/auth.middleware";

import {
  adminRateLimit,
} from "../../../core/middleware/rate-limit.middleware";

import {
  asyncHandler,
} from "../../../core/utils/async-handler";

import {
  rebuildMerkleTree,
  getMerkleJobs,
  getSystemStats,
} from "../controllers/admin.controller";

const router = Router();

/**
 * All admin routes require auth
 */
router.use(
  adminRateLimit,
  authenticateWallet
);

/**
 * GET /admin/stats
 */
router.get(
  "/stats",

  requireAdmin,

  asyncHandler(
    getSystemStats
  )
);

/**
 * GET /admin/merkle/jobs
 */
router.get(
  "/merkle/jobs",

  requireGov,

  asyncHandler(
    getMerkleJobs
  )
);

/**
 * POST /admin/merkle/rebuild
 */
router.post(
  "/merkle/rebuild",

  requireGov,

  asyncHandler(
    rebuildMerkleTree
  )
);

export default router;