import { prisma } from "@core/db/prisma";
import { DistributionType, ClaimStatus } from "@prisma/client";

/**
 * 📊 Get global statistics
 */
export const getGlobalStats = async () => {
  const [
    totalUsers,
    totalParticipants,
    totalClaims,
    pendingClaims,
    claimedClaims,
    failedClaims,
  ] = await Promise.all([
    // ✅ إجمالي المستخدمين
    prisma.user.count(),

    // ✅ إجمالي المشاركين في Airdrop
    prisma.airdropParticipant.count(),

    // ✅ إجمالي المطالبات
    prisma.distributionClaim.count({
      where: { distributionType: DistributionType.AIRDROP },
    }),

    // ✅ المطالبات المعلقة
    prisma.distributionClaim.count({
      where: {
        distributionType: DistributionType.AIRDROP,
        status: ClaimStatus.PENDING,
      },
    }),

    // ✅ المطالبات المكتملة
    prisma.distributionClaim.count({
      where: {
        distributionType: DistributionType.AIRDROP,
        status: ClaimStatus.CLAIMED,
      },
    }),

    // ✅ المطالبات الفاشلة
    prisma.distributionClaim.count({
      where: {
        distributionType: DistributionType.AIRDROP,
        status: ClaimStatus.FAILED,
      },
    }),
  ]);

  // ✅ حساب إجمالي التوزيع من MerkleRoot
  const latestRoot = await prisma.merkleRoot.findFirst({
    where: {
      distributionType: DistributionType.AIRDROP,
      isActive: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // ✅ حساب إجمالي المشتريات من Purchase
  const purchaseStats = await prisma.purchase.aggregate({
    _sum: { paymentAmount: true },
  });

  return {
    totalUsers,
    totalParticipants,
    totalClaims,
    pendingClaims,
    claimedClaims,
    failedClaims,
    totalAirdropAllocated: latestRoot?.totalAmountWei || "0",
    totalPurchasedUsd: purchaseStats._sum.paymentAmount?.toString() || "0",
    airdropClaimRate: totalParticipants > 0
      ? (claimedClaims / totalParticipants) * 100
      : 0,
  };
};
