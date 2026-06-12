// src/shared/utils/wallet.ts  ← ملف جديد مشترك
import { ethers } from "ethers";

/** تطبيع عنوان المحفظة — EIP-55 checksum */
export const normalizeWallet = (wallet: string): string =>
  ethers.getAddress(wallet.trim()).toLowerCase();

/** التحقق من صحة عنوان المحفظة */
export const isValidWallet = (wallet: string): boolean => {
  try { ethers.getAddress(wallet); return true; }
  catch { return false; }
};