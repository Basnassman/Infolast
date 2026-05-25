// src/middleware/roles.ts
import { Request, Response, NextFunction } from "express";
import { ethers } from "ethers";
import { airdropContractRead } from "../blockchain/airdrop.contract";

// Role hashes
const GOVERNANCE_ROLE = ethers.keccak256(ethers.toUtf8Bytes("GOVERNANCE_ROLE"));
const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR_ROLE"));
const DEPOSITOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("DEPOSITOR_ROLE"));
const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";

/**
 * 🔐 Check if address has a specific role
 */
export const hasRole = async (address: string, role: string): Promise<boolean> => {
  try {
    return await airdropContractRead.hasRole(role, address);
  } catch {
    return false;
  }
};

/**
 * ✅ Verify wallet signature
 */
const verifySignature = (wallet: string, message: string, signature: string): boolean => {
  try {
    const recovered = ethers.verifyMessage(message, signature);
    return recovered.toLowerCase() === wallet.toLowerCase();
  } catch {
    return false;
  }
};

/**
 * 🛡️ Extract wallet from request (body, query, or headers)
 */
const extractWallet = (req: Request): string | null => {
  // من الـ headers (للـ Admin Panel)
  const headerWallet = req.headers['x-wallet'] as string;
  const signature = req.headers['x-signature'] as string;
  const message = req.headers['x-message'] as string;
  
  if (headerWallet && signature && message) {
  const isValid = verifySignature(headerWallet, message, signature);
  if (!isValid) {
    throw new Error("Invalid signature");
  }
  return headerWallet.toLowerCase();
  }
  
  // من الـ body (للـ API العادية)
  if (req.body?.wallet) return req.body.wallet.toLowerCase();
  
  // من الـ query
  if (req.query?.wallet) return (req.query.wallet as string).toLowerCase();
  
  return null;
};

/**
 * 👑 Governance role middleware
 */
export const requireGov = async (req: Request, res: Response, next: NextFunction) => {
  const wallet = extractWallet(req);
  
  if (!wallet) {
    return res.status(401).json({ error: "Wallet not provided or invalid signature" });
  }

  // حفظ الـ wallet في req للاستخدام لاحقاً
  (req as any).wallet = wallet;

  const isGov = await hasRole(wallet, GOVERNANCE_ROLE);
  const isAdmin = await hasRole(wallet, DEFAULT_ADMIN_ROLE);

  if (!isGov && !isAdmin) {
    return res.status(403).json({ error: "Governance role required" });
  }

  next();
};

/**
 * 🔧 Operator role middleware
 */
export const requireOperator = async (req: Request, res: Response, next: NextFunction) => {
  const wallet = extractWallet(req);
  
  if (!wallet) {
    return res.status(401).json({ error: "Wallet not provided or invalid signature" });
  }

  (req as any).wallet = wallet;

  const isOperator = await hasRole(wallet, OPERATOR_ROLE);
  const isGov = await hasRole(wallet, GOVERNANCE_ROLE);
  const isAdmin = await hasRole(wallet, DEFAULT_ADMIN_ROLE);

  if (!isOperator && !isGov && !isAdmin) {
    return res.status(403).json({ error: "Operator role required" });
  }

  next();
};

/**
 * 💰 Depositor role middleware
 */
export const requireDepositor = async (req: Request, res: Response, next: NextFunction) => {
  const wallet = extractWallet(req);
  
  if (!wallet) {
    return res.status(401).json({ error: "Wallet not provided or invalid signature" });
  }

  (req as any).wallet = wallet;

  const isDepositor = await hasRole(wallet, DEPOSITOR_ROLE);
  const isGov = await hasRole(wallet, GOVERNANCE_ROLE);
  const isAdmin = await hasRole(wallet, DEFAULT_ADMIN_ROLE);

  if (!isDepositor && !isGov && !isAdmin) {
    return res.status(403).json({ error: "Depositor role required" });
  }

  next();
};

/**
 * 🛡️ Any admin role middleware
 */
export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const wallet = extractWallet(req);
  
  if (!wallet) {
    return res.status(401).json({ error: "Wallet not provided or invalid signature" });
  }

  (req as any).wallet = wallet;

  const isAdmin = await hasRole(wallet, DEFAULT_ADMIN_ROLE);

  if (!isAdmin) {
    return res.status(403).json({ error: "Admin role required" });
  }

  next();
};
