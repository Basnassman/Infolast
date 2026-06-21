import { Request, Response } from "express";
import { purchaseService } from "@modules/purchase/services/purchase.service";
import { syncPurchaseEvents } from "@modules/purchase/sync/purchase.sync";
import { asyncHandler } from "@core/utils/async-handler";
import { ValidationError } from "@core/api/exceptions/validation.error";
import { NotFoundError } from "@core/api/exceptions/not-found.error";
import { successResponse } from "@core/api/responses/success.response";

/**
 * POST /api/purchase/webhook
 *
 * يستقبل من Frontend بعد نجاح الشراء على البلوكشين:
 * {
 *   walletAddress: "0x...",
 *   txHash: "0x..."
 * }
 */
export const purchaseWebhook = asyncHandler(async (req: Request, res: Response) => {
  const { walletAddress, txHash } = req.body;

  if (!walletAddress || !txHash) {
    throw new ValidationError("walletAddress and txHash are required");
  }

  const result = await purchaseService.processFrontendPurchase(walletAddress, txHash);
  return successResponse(res, result);
});

/**
 * POST /api/purchase/sync
 *
 * يشغّل المزامنة اليدوية من الـ Admin
 */
export const triggerSync = asyncHandler(async (_req: Request, res: Response) => {
  const result = await syncPurchaseEvents();
  return successResponse(res, result);
});

/**
 * GET /api/purchase/status/:wallet
 * جلب حالة المستخدم الكاملة
 */
export const userStatus = asyncHandler(async (req: Request, res: Response) => {
  const wallet = req.params.wallet as string;
  const status = await purchaseService.getBuyerProfile(wallet);

  if (!status) {
    throw new NotFoundError("User not found");
  }

  return successResponse(res, status);
});

export const purchaseController = {
  purchaseWebhook,
  triggerSync,
  userStatus,
};
