import { ethers } from "ethers";
import { wallet, provider, config } from "./provider";
import AirdropABI from "../abis/Airdrop.json";

// Read-only contract
export const airdropContractRead = new ethers.Contract(
  config.airdrop,
  AirdropABI,
  provider
);

// Write contract (requires admin wallet)
export const airdropContractWrite = wallet
  ? new ethers.Contract(config.airdrop, AirdropABI, wallet)
  : null;

/**
 * Default airdrop window
 */
export const AIRDROP_DURATION_DAYS = 10;

/**
 * Read current airdrop state from contract
 */
export const getAirdropState = async () => {
  const [
    merkleRoot,
    claimStart,
    claimEnd,
    maxAllocation,
    totalAllocated,
    finalized,
    paused,
  ] = await Promise.all([
    airdropContractRead.merkleRoot(),
    airdropContractRead.claimStart(),
    airdropContractRead.claimEnd(),
    airdropContractRead.maxAllocation(),
    airdropContractRead.totalAllocated(),
    airdropContractRead.finalized(),
    airdropContractRead.paused(),
  ]);

  return {
    merkleRoot,
    claimStart: Number(claimStart),
    claimEnd: Number(claimEnd),
    maxAllocation: maxAllocation.toString(),
    totalAllocated: totalAllocated.toString(),
    finalized,
    paused,
  };
};

/**
 * Check if user already claimed
 */
export const hasUserClaimed = async (
  address: string
): Promise<boolean> => {
  return await airdropContractRead.claimed(address);
};

/**
 * Push Merkle root to contract
 */
export const setMerkleRoot = async (
  root: string,
): Promise<ethers.TransactionResponse> => {

  if (!airdropContractWrite) {
    throw new Error(
      "Airdrop contract write instance not available"
    );
  }

  // ✅ استخدم القيم الحالية من العقد
  const currentState =
    await getAirdropState();

  const tx =
    await airdropContractWrite.setMerkleRoot(
      root,
      currentState.claimStart,
      currentState.claimEnd,
      currentState.maxAllocation
    );

  return tx;
};