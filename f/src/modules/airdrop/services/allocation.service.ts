import { prisma } from "../db/prisma";
import { calculateAirdrop } from "../engine/airdrop.rules";

const DECIMALS = 18;

/**
 * 🔢 Allocation Service
 * Responsible ONLY for:
 * - Converting points to token amounts
 * - Calculating allocations
 * - Determining eligibility
 * 
 * NO Merkle logic
 * NO Blockchain calls
 * NO Reward distribution
 */

/**
 * Convert token amount to wei string
 */
export const toWei = (tokens: string | number): string => {
  return BigInt(Math.floor(Number(tokens) * 10 ** DECIMALS)).toString();
};

/**
 * Convert wei to token amount (for display)
 */
export const fromWei = (wei: string): string => {
  return (Number(wei) / 10 ** DECIMALS).toString();
};

/**
 * Calculate allocation for a single user based on their points
 */
export const calculateUserAllocation = (wallet: string, points: number) => {
  const calculation = calculateAirdrop({ wallet: wallet.toLowerCase(), points });
  
  if (!calculation.approved) {
    return {
      eligible: false,
      tokens: "0",
      tokensWei: "0",
      reason: calculation.reason,
    };
  }

  const tokensWei = toWei(calculation.tokens);

  return {
    eligible: true,
    tokens: calculation.tokens,
    tokensWei,
    reason: null,
  };
};

/**
 * Batch update all user allocations
 * Called by Merkle Worker before building tree
 */
export const batchUpdateAllocations = async (): Promise<{
  updated: number;
  totalEligible: number;
  totalAmountWei: string;
}> => {
  const users = await prisma.user.findMany({
    where: { airdropPoints: { gt: 0 }, isBlocked: false },
    select: { id: true, wallet: true, airdropPoints: true },
  });

  let updated = 0;
  let totalAmountWei = BigInt(0);

  for (const user of users) {
    const allocation = calculateUserAllocation(user.wallet, user.airdropPoints);
    
    if (allocation.eligible && allocation.tokensWei !== "0") {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          airdropAllocated: allocation.tokens,
          airdropAllocatedWei: allocation.tokensWei,
        },
      });
      
      totalAmountWei += BigInt(allocation.tokensWei);
      updated++;
    }
  }

  return {
    updated,
    totalEligible: updated,
    totalAmountWei: totalAmountWei.toString(),
  };
};

/**
 * Get all eligible users with their allocations
 * Used by Merkle Worker to build tree
 */
export const getEligibleUsers = async () => {
  return await prisma.user.findMany({
    where: {
      airdropAllocatedWei: { not: "0" },
      isBlocked: false,
    },
    select: {
      wallet: true,
      airdropAllocatedWei: true,
      airdropPoints: true,
    },
    orderBy: { wallet: "asc" },
  });
};

/**
 * Check if user is eligible for airdrop
 */
/**
 * Check if user is eligible for airdrop
 */
export const isEligible = async (
  wallet: string
): Promise<boolean> => {
  const user = await prisma.user.findUnique({
    where: {
      wallet: wallet.toLowerCase(),
    },
    select: {
      airdropPoints: true,
      airdropAllocatedWei: true,
      isBlocked: true,
    },
  });

  if (!user) {
    return false;
  }

  return (
    !user.isBlocked &&
    user.airdropPoints > 0
  );
};