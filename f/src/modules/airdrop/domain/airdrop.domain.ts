export type AirdropInput = {
  wallet: string;
  points: number;
  totalBought: number;
  chainId?: number;  // default: 11155111 (Sepolia)
};

/**
 * 🧮 Calculate airdrop token amount
 * Base rate: 10 points = 1 token
 * Bonus for buyers: 1.2x - 1.5x multiplier
 */
export const calculateAirdropAmount = (input: AirdropInput): number => {
  const chainId = input.chainId || 11155111;
  
  let base = input.points / 10;

  // Bonus logic based on purchase history
  if (input.totalBought > 10000) {
    base *= 1.5;  // Platinum buyer bonus
  } else if (input.totalBought > 5000) {
    base *= 1.3;  // Gold buyer bonus
  } else if (input.totalBought > 1000) {
    base *= 1.2;  // Silver buyer bonus
  }

  // Sepolia testnet: smaller amounts for testing
  if (chainId === 11155111) {
    base = Math.min(base, 100000); // Cap at 100K tokens for testing
  }

  return Math.floor(base);
};

/**
 * ✅ Validate airdrop input
 */
export const isAirdropValid = (input: AirdropInput): boolean => {
  return (
    input.points > 0 &&
    input.points <= 10000 &&
    input.wallet?.length === 42 &&
    input.wallet?.startsWith("0x")
  );
};

/**
 * 🏷️ Determine user category based on airdrop + purchase
 */
export const getAirdropCategory = (input: AirdropInput): string => {
  const hasAirdrop = input.points > 0;
  const hasBought = input.totalBought > 0;

  if (hasAirdrop && hasBought) return "AIRDROP_BUYER";
  if (hasAirdrop && !hasBought) return "AIRDROP_ONLY";
  if (!hasAirdrop && hasBought) return "BUYER_ONLY";
  return "NONE";
};

/**
 * 🎖️ Determine tier based on total value
 */
export const getAirdropTier = (input: AirdropInput): string => {
  const total = input.points + input.totalBought;

  if (total >= 10001) return "PLATINUM";
  if (total >= 5001) return "GOLD";
  if (total >= 1001) return "SILVER";
  return "BRONZE";
};