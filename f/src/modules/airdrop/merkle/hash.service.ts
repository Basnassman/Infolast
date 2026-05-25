import keccak256 from "keccak256";
import { ethers } from "ethers";

/**
 * 🔐 Pure Merkle Hash Utilities
 * No DB side effects - pure functions only
 */

/**
 * Hash a leaf for the Merkle tree
 * Matches Airdrop.sol: keccak256(abi.encodePacked(msg.sender, amount, block.chainid))
 */
export const hashLeaf = (
  wallet: string,
  amount: string | number | bigint,
  chainId: number = 11155111
): string => {
  const amountBigInt = BigInt(amount);

  const packed = ethers.solidityPacked(
    ["address", "uint256", "uint256"],
    [wallet, amountBigInt, chainId]
  );

  return "0x" + keccak256(packed).toString("hex");
};

/**
 * Hash two nodes together
 */
export const hashPair = (a: string, b: string): string => {
  const sorted = [a, b].sort();
  const packed = ethers.solidityPacked(
    ["bytes32", "bytes32"],
    [sorted[0], sorted[1]]
  );
  return "0x" + keccak256(packed).toString("hex");
};

/**
 * Normalize wallet address for consistent hashing
 */
export const normalizeWallet = (wallet: string): string => {
  return wallet.toLowerCase();
};