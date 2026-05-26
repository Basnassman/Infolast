import { ethers } from "ethers";

import {
  wallet,
  config,
} from "@core/blockchain/provider";

import AirdropABI from "@core/abis/Airdrop";

if (!wallet) {
  throw new Error(
    "Wallet signer not configured"
  );
}

export const airdropWriteContract =
  new ethers.Contract(
    config.airdrop,
    AirdropABI,
    wallet
  );

/**
 * =========================================
 * Claim Methods
 * =========================================
 */

export const submitClaim =
  async (
    allocationWei: string,
    proof: string[]
  ) => {
    return airdropWriteContract.claim(
      allocationWei,
      proof
    );
  };