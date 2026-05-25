import { prisma } from "../db/prisma";
import { UserCategory } from "@prisma/client";
import { syncUserCategory } from "./airdrop.service";

const DECIMALS = 18;

/**
 * تحويل FOR إلى wei
 */
const toWei = (tokens: string | number): string => {
  return (BigInt(Math.floor(Number(tokens) * 10 ** DECIMALS))).toString();
};

/**
 * 🛒 Record a new purchase transaction
 * 
 * يستقبل tokenAmount بالـ FOR ويحولها إلى wei
 */
export const recordPurchase = async (data: {
  buyer: string;
  tokenAmount: string;     // بالـ FOR
  tokenAmountWei?: string; // ← اختياري: بالـ wei (إذا وُفر)
  price: string;
  currency: string;
  txHash: string;
}) => {
  const normalizedBuyer = data.buyer.toLowerCase();
  
  // تحويل إلى wei إذا لم يُزود
  const tokenAmountWei = data.tokenAmountWei || toWei(data.tokenAmount);

  return await prisma.$transaction(async (tx) => {
    // 1. Create purchase record
    const purchase = await tx.purchase.create({
      data: {
        userId: normalizedBuyer,
        txHash: data.txHash,
        amountUsd: data.price,
        tokenAmount: data.tokenAmount,
        tokenAmountWei: tokenAmountWei,  // ← جديد: wei
        tokenPrice: "0",
        currency: data.currency
      }
    });

    // 2. Update user aggregate state
    await tx.user.upsert({
      where: { wallet: normalizedBuyer },
      update: {
        totalBoughtUsd: { increment: data.price },
        purchaseCount: { increment: 1 }
      },
      create: {
        wallet: normalizedBuyer,
        totalBoughtUsd: data.price,
        purchaseCount: 1,
        category: UserCategory.BUYER_ONLY
      }
    });

    // 3. Log transaction
    await tx.auditLog.create({
      data: {
        action: "PURCHASE",
        userId: normalizedBuyer,
        txHash: data.txHash,
        metadata: { 
          amountUsd: data.price, 
          tokenAmount: data.tokenAmount,
          tokenAmountWei: tokenAmountWei  // ← جديد
        }
      }
    });

    // 4. Sync category
    await syncUserCategory(normalizedBuyer);

    return purchase;
  });
};

/**
 * ✅ Record token claim for purchases (Vesting)
 */
export const recordPurchaseClaim = async (wallet: string, txHash: string, amountWei?: string) => {
  const normalizedWallet = wallet.toLowerCase();

  return await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { wallet: normalizedWallet }
    });

    if (!user) throw new Error("User not found");
    if (user.hasClaimedTokens) throw new Error("Tokens already claimed");

    // إنشاء سجل Vesting Claim
    if (amountWei) {
      await tx.vestingClaim.create({
        data: {
          userId: normalizedWallet,
          txHash,
          amountWei,
          amountFor: user.totalBoughtUsd, // تقريبي
        }
      });
    }

    const updatedUser = await tx.user.update({
      where: { wallet: normalizedWallet },
      data: {
        hasClaimedTokens: true,
        tokensClaimedAt: new Date(),
        tokensClaimTxHash: txHash
      }
    });

    await tx.auditLog.create({
      data: {
        action: "PURCHASE_CLAIM",
        userId: normalizedWallet,
        txHash,
        metadata: { 
          totalSpent: user.totalBoughtUsd,
          amountWei: amountWei || null
        }
      }
    });

    return updatedUser;
  });
};

/**
 * 📊 Get detailed user status (Airdrop + Purchase)
 */
export const getUserFullStatus = async (wallet: string) => {
  return await prisma.user.findUnique({
    where: { wallet: wallet.toLowerCase() },
    include: {
      purchases: {
        orderBy: { createdAt: "desc" }
      },
      airdropClaims: {
        orderBy: { createdAt: "desc" }
      },
      vestingClaims: {
        orderBy: { createdAt: "desc" }
      },
      auditLogs: {
        orderBy: { createdAt: "desc" },
        take: 10
      }
    }
  });
};