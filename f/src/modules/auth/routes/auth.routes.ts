import { Router } from "express";
import { ethers } from "ethers";
import { airdropContractRead } from "../../../core/blockchain/airdrop.contract";

const router = Router();

const GOVERNANCE_ROLE = ethers.keccak256(
  ethers.toUtf8Bytes("GOVERNANCE_ROLE")
);

const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;

router.get("/check-role", async (req, res) => {
  try {
    const wallet = req.query.wallet as string;

    if (!wallet) {
      return res.status(400).json({
        error: "wallet is required"
      });
    }

    const isGov = await airdropContractRead.hasRole(
      GOVERNANCE_ROLE,
      wallet
    );

    const isAdmin = await airdropContractRead.hasRole(
      DEFAULT_ADMIN_ROLE,
      wallet
    );

    res.json({
      wallet,
      isGov,
      isAdmin
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.message
    });
  }
});

export default router;