import { ethers } from "ethers";

import {
  wallet,
  config,
} from "@core/blockchain/provider";

import AirdropABI from "@core/abis/Airdrop";

if (!wallet) {
  throw new Error(
    "Admin wallet not configured"
  );
}

export const airdropAdminContract =
  new ethers.Contract(
    config.airdrop,
    AirdropABI,
    wallet
  );

/**
 * =========================================
 * Admin Methods
 * =========================================
 */

export const pushMerkleRoot =
  async (
    root: string
  ): Promise<string> => {
    const tx =
      await airdropAdminContract.setMerkleRoot(
        root
      );

    const receipt =
      await tx.wait();

    if (
      !receipt ||
      receipt.status !== 1
    ) {
      throw new Error(
        "Failed to push merkle root"
      );
    }

    return tx.hash;
  };

export const pauseAirdrop =
  async () => {
    const tx =
      await airdropAdminContract.pause();

    return tx.wait();
  };

export const unpauseAirdrop =
  async () => {
    const tx =
      await airdropAdminContract.unpause();

    return tx.wait();
  };