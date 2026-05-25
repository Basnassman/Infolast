import { Request, Response } from "express";
import { 
  recordPurchase, 
  recordPurchaseClaim,
  getUserFullStatus 
} from "../services/purchase.service";

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
export const purchaseWebhook = async (req: Request, res: Response) => {
  try {
    const { buyer, tokenAmount, tokenAmountWei, price, currency, txHash } = req.body;
    
    if (!buyer || !tokenAmount || !txHash) {
      return res.status(400).json({
        success: false,
        error: "buyer, tokenAmount, and txHash are required"
      });
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
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

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
export const claimPurchaseTokens = async (req: Request, res: Response) => {
  try {
    const { wallet, txHash, amount } = req.body;
    
    if (!wallet || !txHash) {
      return res.status(400).json({
        success: false,
        error: "wallet and txHash are required"
      });
    }

    const result = await recordPurchaseClaim(wallet, txHash, amount);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * GET /api/purchase/status/:wallet
 * جلب حالة المستخدم الكاملة
 */
export const userStatus = async (req: Request, res: Response) => {
  try {
    const wallet = req.params.wallet as string;
    const status = await getUserFullStatus(wallet);
    
    if (!status) {
      return res.status(404).json({ success: false, error: "User not found" });
    }
    
    res.json({ success: true, data: status });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const purchaseController = {
  purchaseWebhook,
  claimPurchaseTokens,
  userStatus
};