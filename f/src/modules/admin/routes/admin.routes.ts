import { Router } from "express";

import {
  requireAdmin,
  requireGov,
} from "@core/middleware/role.middleware";

import {
  authenticate,
} from "@core/middleware/auth.middleware";

import {
  rateLimit,
} from "@core/middleware/rate-limit.middleware";

import {
  asyncHandler,
} from "@core/utils/async-handler";

import {
  rebuildMerkleController,
  getMerkleJobsController,
  getLatestRootController,
} from "@modules/admin/controllers/admin.controller";

const router = Router();

/**
 * All admin routes require auth
 */
router.use(
  rateLimit({ windowMs: 60000, maxRequests: 30 }),
  authenticate
);

/**
 * GET /admin/stats
 */
router.get(
  "/stats",

  requireAdmin,

  getLatestRootController
);

/**
 * GET /admin/merkle/jobs
 */
router.get(
  "/merkle/jobs",

  requireGov,

  getMerkleJobsController
);

/**
 * POST /admin/merkle/rebuild
 */
router.post(
  "/merkle/rebuild",

  requireGov,

  rebuildMerkleController
);

export default router;