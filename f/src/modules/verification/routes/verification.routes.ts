import { Router } from "express";
import { walletRateLimit } from "@core/middleware/rate-limit.middleware";
import { validateRequest, validateQuery } from "@core/middleware/validate-request.middleware";
import { authenticate } from "@core/middleware/auth.middleware";
import { requireRole } from "@core/middleware/role.middleware";
import { asyncHandler } from "@core/utils/async-handler";
import {
  getVerificationTasksController,
  createVerificationTaskController,
  updateVerificationTaskController,
  toggleVerificationTaskController,
  verifyTaskController,
  getVerificationStatusController,
  generateDeepLinkController,
  getLinkedAccountsController,
  unlinkAccountController,
  checkEligibilityController,
  verifyBeforeClaimController,
  triggerReverificationController,
} from "../controllers/verification.controller";
import {
  createVerificationTaskSchema,
  updateVerificationTaskSchema,
  verifyTaskSchema,
  generateDeepLinkSchema,
  verificationWalletQuerySchema,
} from "../dto/verification.dto";

const router = Router();

// ─── Composed admin middleware: authenticate + role check ─────────────────────
const adminAuthMiddleware = [authenticate, requireRole("ADMIN")];

// ─── Admin Routes (Task Management) ──────────────────────────────────────────

router.get(
  "/tasks",
  ...adminAuthMiddleware,
  asyncHandler(getVerificationTasksController)
);

router.post(
  "/tasks",
  ...adminAuthMiddleware,
  validateRequest(createVerificationTaskSchema),
  asyncHandler(createVerificationTaskController)
);

router.put(
  "/tasks/:id",
  ...adminAuthMiddleware,
  validateRequest(updateVerificationTaskSchema),
  asyncHandler(updateVerificationTaskController)
);

router.patch(
  "/tasks/:id/toggle",
  ...adminAuthMiddleware,
  asyncHandler(toggleVerificationTaskController)
);

// ─── User Routes ─────────────────────────────────────────────────────────────

router.get(
  "/status",
  walletRateLimit,
  validateQuery(verificationWalletQuerySchema),
  asyncHandler(getVerificationStatusController)
);

router.post(
  "/verify",
  walletRateLimit,
  validateRequest(verifyTaskSchema),
  asyncHandler(verifyTaskController)
);

// ─── Account Linking ─────────────────────────────────────────────────────────

router.post(
  "/link",
  walletRateLimit,
  validateRequest(generateDeepLinkSchema),
  asyncHandler(generateDeepLinkController)
);

router.get(
  "/linked-accounts",
  walletRateLimit,
  validateQuery(verificationWalletQuerySchema),
  asyncHandler(getLinkedAccountsController)
);

router.post(
  "/unlink",
  walletRateLimit,
  asyncHandler(unlinkAccountController)
);

// ─── Eligibility ─────────────────────────────────────────────────────────────

router.get(
  "/eligibility",
  walletRateLimit,
  validateQuery(verificationWalletQuerySchema),
  asyncHandler(checkEligibilityController)
);

router.post(
  "/verify-before-claim",
  walletRateLimit,
  asyncHandler(verifyBeforeClaimController)
);

// ─── Admin Reverification ────────────────────────────────────────────────────

router.post(
  "/reverify",
  ...adminAuthMiddleware,
  asyncHandler(triggerReverificationController)
);

export default router;
