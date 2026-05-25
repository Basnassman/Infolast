import { prisma } from "../db/prisma";

/**
 * 📊 Get global statistics
 */
export const getGlobalStats = async () => {
  const [
    totalUsers,
    airdropStats,
    purchaseStats,
    claimedAirdropCount,
    claimedTokensCount
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.aggregate({
      _sum: { airdropAllocated: true }
    }),
    prisma.user.aggregate({
      _sum: { totalBoughtUsd: true }
    }),
    prisma.user.count({ where: { hasClaimedAirdrop: true } }),
    prisma.user.count({ where: { hasClaimedTokens: true } })
  ]);

  return {
    totalUsers,
    totalAirdropAllocated: airdropStats._sum.airdropAllocated || 0,
    totalPurchasedUsd: purchaseStats._sum.totalBoughtUsd || 0,
    claimedAirdropCount,
    claimedTokensCount,
    airdropClaimRate: totalUsers > 0 ? (claimedAirdropCount / totalUsers) * 100 : 0
  };
};
