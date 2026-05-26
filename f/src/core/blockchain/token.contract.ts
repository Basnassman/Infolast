import { ethers } from "ethers";
import { wallet, provider, config } from "@core/blockchain/provider";
import TokenABI from "@core/abis/Token";

// Read-only contract
export const tokenContractRead = new ethers.Contract(
  config.token,
  TokenABI,
  provider
);

// Write contract (requires admin wallet)
export const tokenContractWrite = wallet
  ? new ethers.Contract(config.token, TokenABI, wallet)
  : null;

// Token info
export const getTokenInfo = async () => {
  const [name, symbol, decimals, totalSupply] = await Promise.all([
    tokenContractRead.name(),
    tokenContractRead.symbol(),
    tokenContractRead.decimals(),
    tokenContractRead.totalSupply(),
  ]);

  return {
    name,
    symbol,
    decimals: Number(decimals),
    totalSupply: totalSupply.toString(),
    address: config.token,
  };
};

// Balance of
export const getTokenBalance = async (address: string): Promise<string> => {
  const balance = await tokenContractRead.balanceOf(address);
  return balance.toString();
};

// Allowance
export const getAllowance = async (owner: string, spender: string): Promise<string> => {
  const allowance = await tokenContractRead.allowance(owner, spender);
  return allowance.toString();
};

// Transfer (admin only)
export const transferTokens = async (to: string, amount: string) => {
  if (!tokenContractWrite) throw new Error("Admin wallet not configured");
  const tx = await tokenContractWrite.transfer(to, amount);
  return tx.hash;
};

// Approve (admin only)
export const approveTokens = async (spender: string, amount: string) => {
  if (!tokenContractWrite) throw new Error("Admin wallet not configured");
  const tx = await tokenContractWrite.approve(spender, amount);
  return tx.hash;
};