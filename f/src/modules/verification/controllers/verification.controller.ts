import { Request, Response } from "express";
import { asyncHandler } from "@core/utils/async-handler";
import { successResponse } from "@core/api/responses/success.response";
import { verificationService } from "../services/verification.service";
import { verificationEligibilityService } from "../services/eligibility.service";
import { accountLinkingService } from "../services/account-linking.service";
import { verificationTaskRepository } from "../repositories/verification-task.repository";
import { reverificationService } from "../services/reverification.service";
import { verificationQueue } from "../queues/verification.queue";
import { reverificationQueue } from "../queues/reverification.queue";
import { getOrCreateUser } from "@modules/user/utils/user";

/**
 * =====================================================
 * VERIFICATION CONTROLLER
 * =====================================================
 *
 * Handles all verification-related HTTP endpoints.
 */

// ─── Helpers ─────────────────────────────────────────────────────────────────

const asString = (val: unknown): string => String(val ?? "");

// ─── Verification Tasks (Admin) ──────────────────────────────────────────────

export const getVerificationTasksController = asyncHandler(
  async (req: Request, res: Response) => {
    const tasks = await verificationTaskRepository.findAll();
    return successResponse(res, tasks);
  }
);

export const createVerificationTaskController = asyncHandler(
  async (req: Request, res: Response) => {
    const task = await verificationTaskRepository.create(req.body);
    return successResponse(res, task, 201);
  }
);

export const updateVerificationTaskController = asyncHandler(
  async (req: Request, res: Response) => {
    const id = asString(req.params.id);
    const task = await verificationTaskRepository.update(id, req.body);
    return successResponse(res, task);
  }
);

export const toggleVerificationTaskController = asyncHandler(
  async (req: Request, res: Response) => {
    const id = asString(req.params.id);
    const task = await verificationTaskRepository.toggle(id);
    return successResponse(res, task);
  }
);

// ─── User Verification ───────────────────────────────────────────────────────

export const verifyTaskController = asyncHandler(
  async (req: Request, res: Response) => {
    const { walletAddress, verificationTaskId } = req.body;

    const user = await getOrCreateUser(walletAddress);

    // Enqueue verification job
    await verificationQueue.add("verify", {
      userId: user.id,
      verificationTaskId,
      walletAddress,
    });

    return successResponse(res, {
      message: "Verification job queued",
      status: "pending",
    });
  }
);

export const getVerificationStatusController = asyncHandler(
  async (req: Request, res: Response) => {
    const walletAddress = asString(req.query.walletAddress);

    const user = await getOrCreateUser(walletAddress);

    const verifiedTasks = await verificationService.getUserVerifiedTasks(user.id);

    return successResponse(res, {
      verifiedTasks: verifiedTasks.map((vt: any) => ({
        id: vt.id,
        verificationTaskId: vt.verificationTaskId,
        status: vt.status,
        verifiedAt: vt.verifiedAt,
        lastCheckedAt: vt.lastCheckedAt,
        task: {
          title: vt.verificationTask?.title ?? "",
          platform: vt.verificationTask?.platform ?? "",
        },
      })),
    });
  }
);

// ─── Account Linking ─────────────────────────────────────────────────────────

export const generateDeepLinkController = asyncHandler(
  async (req: Request, res: Response) => {
    const { walletAddress, platform } = req.body;

    const result = await accountLinkingService.generateDeepLink(
      walletAddress,
      platform
    );

    return successResponse(res, result);
  }
);

export const getLinkedAccountsController = asyncHandler(
  async (req: Request, res: Response) => {
    const walletAddress = asString(req.query.walletAddress);

    const accounts = await accountLinkingService.getLinkedAccounts(walletAddress);

    return successResponse(res, {
      accounts: accounts.map((a) => ({
        platform: a.platform,
        platformUsername: a.platformUsername,
        verified: a.verified,
        linkedAt: a.linkedAt,
      })),
    });
  }
);

export const unlinkAccountController = asyncHandler(
  async (req: Request, res: Response) => {
    const { walletAddress, platform } = req.body;

    await accountLinkingService.unlinkAccount(walletAddress, platform);

    return successResponse(res, { message: "Account unlinked" });
  }
);

// ─── Eligibility ─────────────────────────────────────────────────────────────

export const checkEligibilityController = asyncHandler(
  async (req: Request, res: Response) => {
    const walletAddress = asString(req.query.walletAddress);

    const user = await getOrCreateUser(walletAddress);
    const result = await verificationEligibilityService.checkEligibility(user.id);

    return successResponse(res, result);
  }
);

export const verifyBeforeClaimController = asyncHandler(
  async (req: Request, res: Response) => {
    const walletAddress = req.body.walletAddress;

    const user = await getOrCreateUser(walletAddress);
    const result = await verificationEligibilityService.verifyBeforeClaim(user.id);

    return successResponse(res, result);
  }
);

// ─── Reverification (Admin) ──────────────────────────────────────────────────

export const triggerReverificationController = asyncHandler(
  async (req: Request, res: Response) => {
    const { verificationTaskId } = req.body;

    await reverificationQueue.add("reverify", {
      verificationTaskId: verificationTaskId || undefined,
    });

    return successResponse(res, {
      message: "Reverification job queued",
    });
  }
);
