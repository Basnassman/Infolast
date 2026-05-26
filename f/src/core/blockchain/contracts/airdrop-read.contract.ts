import { ethers } from "ethers";

import {
  provider,
  config,
} from "../provider";

import AirdropABI from "../../abis/Airdrop.json";

export const airdropReadContract =
  new ethers.Contract(
    config.airdrop,
    AirdropABI,
    provider
  );

/**
 * =========================================
 * Root
 * =========================================
 */

export const getMerkleRoot =
  async (): Promise<string> => {
    return airdropReadContract.merkleRoot();
  };

/**
 * =========================================
 * Claim Status
 * =========================================
 */

export const hasClaimed =
  async (
    walletAddress: string
  ): Promise<boolean> => {
    return airdropReadContract.claimed(
      walletAddress
    );
  };

/**
 * =========================================
 * Contract State
 * =========================================
 */

export const getAirdropState =
  async () => {
    const [
      merkleRoot,
      paused,
      finalized,
      totalAllocated,
      maxAllocation,
    ] = await Promise.all([
      airdropReadContract.merkleRoot(),

      airdropReadContract.paused(),

      airdropReadContract.finalized(),

      airdropReadContract.totalAllocated(),

      airdropReadContract.maxAllocation(),
    ]);

    return {
      merkleRoot,

      paused,

      finalized,

      totalAllocated:
        totalAllocated.toString(),

      maxAllocation:
        maxAllocation.toString(),
    };
  };