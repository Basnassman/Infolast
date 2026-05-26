import { ethers } from "ethers";
import { wallet, provider, config } from "@core/blockchain/provider";
import VestingABI from "@core/abis/Vesting";

// Read-only contract
export const vestingContractRead = new ethers.Contract(
  config.vesting,
  VestingABI,
  provider
);

// Write contract (requires admin wallet)
export const vestingContractWrite = wallet
  ? new ethers.Contract(config.vesting, VestingABI, wallet)
  : null;

// Vesting info
export const getVestingInfo = async () => {
  const [token, treasury, startTime, totalAllocated, totalClaimed, paused] = 
    await Promise.all([
      vestingContractRead.token(),
      vestingContractRead.treasury(),
      vestingContractRead.startTime(),
      vestingContractRead.totalAllocated(),
      vestingContractRead.totalClaimed(),
      vestingContractRead.paused(),
    ]);

  return {
    token,
    treasury,
    startTime: Number(startTime),
    totalAllocated: totalAllocated.toString(),
    totalClaimed: totalClaimed.toString(),
    paused,
    address: config.vesting,
  };
};

// User vesting schedule
export const getUserVesting = async (address: string) => {
  const [schedule, releasable] = await Promise.all([
    vestingContractRead.vesting(address),
    vestingContractRead.releasable(address),
  ]);

  return {
    total: schedule[0].toString(),
    claimed: schedule[1].toString(),
    releasable: releasable.toString(),
    remaining: (schedule[0] - schedule[1]).toString(),
  };
};

// Constants
export const getVestingConstants = async () => {
  const [cliff, month, totalStages, stageShare] = await Promise.all([
    vestingContractRead.CLIFF(),
    vestingContractRead.MONTH(),
    vestingContractRead.TOTAL_STAGES(),
    vestingContractRead.STAGE_SHARE(),
  ]);

  return {
    cliff: Number(cliff),
    month: Number(month),
    totalStages: Number(totalStages),
    stageShare: Number(stageShare),
  };
};

// Claim (user calls this from frontend)
export const claimVesting = async () => {
  if (!vestingContractWrite) throw new Error("Wallet not configured");
  const tx = await vestingContractWrite.claim();
  return tx.hash;
};

// Allocate (admin only)
export const allocateVesting = async (user: string, amount: string) => {
  if (!vestingContractWrite) throw new Error("Admin wallet not configured");
  const tx = await vestingContractWrite.allocate(user, amount);
  return tx.hash;
};

// Deposit (admin only)
export const depositTokens = async (amount: string) => {
  if (!vestingContractWrite) throw new Error("Admin wallet not configured");
  const tx = await vestingContractWrite.deposit(amount);
  return tx.hash;
};