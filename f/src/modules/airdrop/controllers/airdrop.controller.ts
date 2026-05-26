import {
  Request,
  Response,
} from "express";

import {
  getAirdropEligibility,
  getAirdropStats,
} from "../services/airdrop.service";

import {
  recordClaim,
  getClaimStatus,
} from "../services/claim.service";

import {
  validateClaim,
} from "../services/claim-validation.service";

import {
  getActiveMerkleRoot,
  getProofByWallet,
} from "../repositories/claim.repository";

export const checkEligibility =
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const wallet =
        String(
          req.params.wallet
        ).toLowerCase();

      const result =
        await getAirdropEligibility(
          wallet
        );

      return res.json(result);
    } catch (error: any) {
      return res.status(500).json({
        error:
          error.message,
      });
    }
  };

export const getProofHandler =
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const wallet =
        String(
          req.query.wallet
        ).toLowerCase();

      const activeRoot =
        await getActiveMerkleRoot();

      if (!activeRoot) {
        return res.status(404).json({
          error:
            "No active root",
        });
      }

      const proof =
        await getProofByWallet(
          activeRoot.id,
          wallet
        );

      if (!proof) {
        return res.status(404).json({
          error:
            "Proof not found",
        });
      }

      return res.json(proof);
    } catch (error: any) {
      return res.status(500).json({
        error:
          error.message,
      });
    }
  };

export const recordAirdropClaim =
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const {
        walletAddress,
        txHash,
      } = req.body;

      const validation =
        await validateClaim(
          walletAddress
        );

      if (!validation.valid) {
        return res.status(400).json({
          error:
            validation.reason,
        });
      }

      const result =
        await recordClaim(
          walletAddress,
          txHash
        );

      return res.json({
        success: true,
        claim: result,
      });
    } catch (error: any) {
      return res.status(500).json({
        error:
          error.message,
      });
    }
  };

export const getClaimStatusHandler =
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const wallet =
        String(
          req.params.wallet
        ).toLowerCase();

      const result =
        await getClaimStatus(
          wallet
        );

      return res.json(result);
    } catch (error: any) {
      return res.status(500).json({
        error:
          error.message,
      });
    }
  };

export const getStats =
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const stats =
        await getAirdropStats();

      return res.json(stats);
    } catch (error: any) {
      return res.status(500).json({
        error:
          error.message,
      });
    }
  };
