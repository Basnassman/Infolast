import { ethers } from "ethers";

/**
 * ✅ Validate Ethereum address
 */
export const isValidAddress = (address: string): boolean => {
  return ethers.isAddress(address);
};

/**
 * ✅ Validate address checksum
 */
export const isValidChecksum = (address: string): boolean => {
  return ethers.isAddress(address) && address === ethers.getAddress(address);
};

/**
 * 🔢 Validate BigInt string
 */
export const isValidBigInt = (value: string): boolean => {
  try {
    BigInt(value);
    return true;
  } catch {
    return false;
  }
};

/**
 * 📊 Validate airdrop points
 */
export const isValidPoints = (points: number): boolean => {
  return Number.isInteger(points) && points > 0 && points <= 10000;
};

/**
 * 💰 Validate amount (for purchases)
 */
export const isValidAmount = (amount: string): boolean => {
  try {
    const value = BigInt(amount);
    return value > 0n;
  } catch {
    return false;
  }
};

/**
 * 🌿 Validate Merkle proof
 */
export const isValidProof = (proof: string[]): boolean => {
  if (!Array.isArray(proof) || proof.length === 0) return false;
  
  return proof.every((p) => 
    typeof p === "string" && 
    p.startsWith("0x") && 
    p.length === 66
  );
};

/**
 * 🔗 Validate chain ID
 */
export const isValidChainId = (chainId: number): boolean => {
  return chainId === 11155111; // Sepolia only
};

/**
 * 📅 Validate timestamp
 */
export const isValidTimestamp = (timestamp: number): boolean => {
  const now = Math.floor(Date.now() / 1000);
  return timestamp > 0 && timestamp < now + 86400 * 365; // Within 1 year
};

/**
 * 📝 Validate claim request
 */
export const validateClaimRequest = (data: {
  wallet: string;
  amount: string;
  proof: string[];
  chainId?: number;
}): { valid: boolean; error?: string } => {
  if (!isValidAddress(data.wallet)) {
    return { valid: false, error: "Invalid wallet address" };
  }

  if (!isValidBigInt(data.amount)) {
    return { valid: false, error: "Invalid amount" };
  }

  if (!isValidProof(data.proof)) {
    return { valid: false, error: "Invalid Merkle proof" };
  }

  if (data.chainId && !isValidChainId(data.chainId)) {
    return { valid: false, error: "Invalid chain ID (Sepolia only)" };
  }

  return { valid: true };
};

/**
 * 📝 Validate airdrop request
 */
export const validateAirdropRequest = (data: {
  wallet: string;
  points: number;
}): { valid: boolean; error?: string } => {
  if (!isValidAddress(data.wallet)) {
    return { valid: false, error: "Invalid wallet address" };
  }

  if (!isValidPoints(data.points)) {
    return { valid: false, error: "Points must be between 1 and 10000" };
  }

  return { valid: true };
};

/**
 * 📝 Validate purchase request
 */
export const validatePurchaseRequest = (data: {
  wallet: string;
  amount: string;
  currency?: string;
}): { valid: boolean; error?: string } => {
  if (!isValidAddress(data.wallet)) {
    return { valid: false, error: "Invalid wallet address" };
  }

  if (!isValidAmount(data.amount)) {
    return { valid: false, error: "Invalid amount" };
  }

  return { valid: true };
};