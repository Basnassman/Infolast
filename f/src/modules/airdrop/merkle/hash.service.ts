import keccak256 from "keccak256";
import { ethers } from "ethers";

const DEFAULT_CHAIN_ID = 11155111;

export const normalizeWallet = (wallet: string): string => {
  return ethers.getAddress(wallet);
};

export const hashLeaf = (
  wallet: string,
  amount: string | number | bigint,
  chainId: number = DEFAULT_CHAIN_ID
): string => {
  const normalizedWallet = normalizeWallet(wallet);
  const amountBigInt = BigInt(amount);
  const packed = ethers.solidityPacked(
    ["address", "uint256", "uint256"],
    [normalizedWallet, amountBigInt, chainId]
  );

  return "0x" + keccak256(packed).toString("hex");
};

export const hashPair = (a: string, b: string): string => {
  const sorted = [a, b].sort();
  const packed = ethers.solidityPacked(["bytes32", "bytes32"], [sorted[0], sorted[1]]);

  return "0x" + keccak256(packed).toString("hex");
};
