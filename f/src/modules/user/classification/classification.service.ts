import { prisma } from "../db/prisma";
import { UserTier } from "@prisma/client";

/**
 * 🎖️ Determine user tier based on activity
 */
export const calculateTier = (points: number, spentUsd: number): UserTier => {
  const score = points + (spentUsd * 10); // Weighting purchases
  
  if (score >= 50000) return UserTier.PLATINUM;
  if (score >= 10000) return UserTier.GOLD;
  if (score >= 2000) return UserTier.SILVER;
  return UserTier.BRONZE;
};

/**
 * 🔄 Update user tier in DB
 */
export const updateUserTier = async (wallet: string) => {
  const user = await prisma.user.findUnique({
    where: { wallet: wallet.toLowerCase() }
  });

  if (!user) return;

  const tier = calculateTier(
    user.airdropPoints, 
    Number(user.totalBoughtUsd)
  );

  return await prisma.user.update({
    where: { wallet: user.wallet },
    data: { tier }
  });
};
