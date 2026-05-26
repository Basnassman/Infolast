import { Request, Response } from "express";
import {
  recordVestingClaim,
  getUserVestingStatus,
  getUserVestingClaims,
} from "@modules/vesting/services/vesting.service";

/**
 * POST /api/vesting/claim
 * 
 * يستقبل من Frontend بعد سحب التوكنز من العقد:
 * {
 *   wallet: "0x...",
 *   txHash: "0x...",
 *   amount: "25000000000000000000"  // wei
 * }
 */
export const claimVesting = async (req: Request, res: Response) => {
  try {
    const { wallet, txHash, amount } = req.body;

    if (!wallet || !txHash || !amount) {
      return res.status(400).json({
        success: false,
        error: "wallet, txHash, and amount are required"
      });
    }

    const result = await recordVestingClaim(wallet, txHash, amount);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * GET /api/vesting/status/:wallet
 * جلب حالة الاستحقاق للمستخدم
 */
export const vestingStatus = async (req: Request, res: Response) => {
  try {
    const wallet = req.params.wallet as string;
    const status = await getUserVestingStatus(wallet);
    res.json({ success: true, data: status });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * GET /api/vesting/claims/:wallet
 * جلب سجل سحوبات المستخدم
 */
export const vestingClaims = async (req: Request, res: Response) => {
  try {
    const wallet = req.params.wallet as string;
    const claims = await getUserVestingClaims(wallet);
    res.json({ success: true, data: claims });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const vestingController = {
  claimVesting,
  vestingStatus,
  vestingClaims,
};