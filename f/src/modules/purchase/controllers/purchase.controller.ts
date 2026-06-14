import { Request, Response } from "express";
import { 
  recordPurchase, 
  recordPurchaseClaim,
  getUserFullStatus 
} from "@modules/purchase/services/purchase.service";
import { asyncHandler } from "@core/utils/async-handler";
import { ValidationError } from "@core/api/exceptions/validation.error";
import { NotFoundError } from "@core/api/exceptions/not-found.error";

/**
 * POST /api/purchase/webhook
 * 
 * يستقبل من Frontend بعد نجاح الشراء على البلوكشين:
 * {
 *   buyer: "0x...",
 *   tokenAmount: "100",              // بالـ FOR
 *   tokenAmountWei: "100000000000000000000", // ← بالـ wei (اختياري)
 *   price: "201.50",
 *   currency: "ETH",
 *   txHash: "0x..."
 * }
 */
export const purchaseWebhook = asyncHandler(async (req: Request, res: Response) => {
  const { buyer, tokenAmount, tokenAmountWei, price, currency, txHash } = req.body;
  
  if (!buyer || !tokenAmount || !txHash) {
    throw new ValidationError("buyer, tokenAmount, and txHash are required");
  }

  const result = await recordPurchase({
    buyer,
    tokenAmount,
    tokenAmountWei,
    price,
    currency,
    txHash
  });
  
  res.json({ success: true, data: result });
});

/**
 * POST /api/purchase/claim
 * 
 * يستقبل من Frontend بعد سحب التوكنز من Vesting:
 * {
 *   wallet: "0x...",
 *   txHash: "0x...",
 *   amount: "25000000000000000000"  // ← wei (اختياري)
 * }
 */
export const claimPurchaseTokens = asyncHandler(async (req: Request, res: Response) => {
  const { wallet, txHash, amount } = req.body;
  
  if (!wallet || !txHash) {
    throw new ValidationError("wallet and txHash are required");
  }

  const result = await recordPurchaseClaim(wallet, txHash, amount);
  res.json({ success: true, data: result });
});

/**
 * GET /api/purchase/status/:wallet
 * جلب حالة المستخدم الكاملة
 */
export const userStatus = asyncHandler(async (req: Request, res: Response) => {
  const wallet = req.params.wallet as string;
  const status = await getUserFullStatus(wallet);
  
  if (!status) {
    throw new NotFoundError("User not found");
  }
  
  res.json({ success: true, data: status });
});

export const purchaseController = {
  purchaseWebhook,
  claimPurchaseTokens,
  userStatus
};