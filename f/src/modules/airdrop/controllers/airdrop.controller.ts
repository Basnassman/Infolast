import { Request, Response } from "express";
import { getAirdropEligibility, getAirdropStats } from "../services/airdrop.service";
import { validateClaim, recordClaim, getClaimStatus } from "../services/claim.service";
import { prisma } from "../../../core/db/prisma";

/**
 * 🪂 Airdrop Controller (Refactored)
 * Uses separated services:
 * - airdrop.service: eligibility queries
 * - claim.service: claim validation & recording
 */

/**
 * GET /airdrop/eligibility/:wallet
 * Check if user is eligible for airdrop
 */
export const checkEligibility = async (req: Request, res: Response) => {
  try {
    const walletParam = req.params.wallet as string;
    if (!walletParam || typeof walletParam !== "string") {
      return res.status(400).json({ error: "Wallet address required" });
    }

    const result = await getAirdropEligibility(walletParam);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /airdrop/claim
 * Record a claim after on-chain transaction
 */
export const recordAirdropClaim = async (req: Request, res: Response) => {
  try {
    const { wallet, txHash, amountWei } = req.body;

    if (!wallet || !txHash) {
      return res.status(400).json({ error: "Wallet and txHash required" });
    }

    // Validate claim first
    const validation = await validateClaim(wallet);
    if (!validation.valid) {
      return res.status(400).json({
        error: validation.reason || "Claim validation failed",
      });
    }

    // Record the claim
    const result = await recordClaim(wallet, txHash, amountWei);

    res.json({
      success: true,
      user: result,
      amountWei: validation.amountWei,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};

/**
 * GET /airdrop/stats
 * Get airdrop statistics
 */
export const getStats = async (req: Request, res: Response) => {
  try {
    const stats = await getAirdropStats();
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /airdrop/claim-status/:wallet
 * Get claim status for a user
 */
export const getClaimStatusHandler = async (req: Request, res: Response) => {
  try {
    const walletParam = req.params.wallet as string;
    if (!walletParam || typeof walletParam !== "string") {
      return res.status(400).json({ error: "Wallet address required" });
    }

    const result = await getClaimStatus(walletParam);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

  export const getProofHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const wallet =
      String(req.query.wallet || "").toLowerCase();

    if (!wallet) {
      return res.status(400).json({
        error: "Wallet is required",
      });
    }

    const user = await prisma.user.findUnique({
      where: { wallet },
      select: {
        wallet: true,
        merkleProof: true,
        airdropAllocatedWei: true,
        merkleLeaf: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    return res.json({
      wallet: user.wallet,
      amount: user.airdropAllocatedWei,
      proof: user.merkleProof || [],
      leaf: user.merkleLeaf,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error.message,
    });
  }
};