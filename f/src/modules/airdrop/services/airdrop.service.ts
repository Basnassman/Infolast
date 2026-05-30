export const getAirdropStats = async () => {
  const [users, participants, claims, activeRoot, totalPoints] = await Promise.all([
    prisma.user.count(),
    prisma.airdropParticipant.count(),
    prisma.distributionClaim.count({
      where: { distributionType: DistributionType.AIRDROP },
    }),
    prisma.merkleRoot.findFirst({
      where: {
        distributionType: DistributionType.AIRDROP,
        isActive: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    // ✅ إضافة
    prisma.airdropParticipant.aggregate({
      _sum: { points: true },
    }),
  ]);

  return {
    totalUsers: users,
    participants,
    claims,
    activeRoot: activeRoot?.root || null,
    eligibleCount: activeRoot?.eligibleCount || 0,
    totalAmountWei: activeRoot?.totalAmountWei || "0",
    totalPoints: totalPoints._sum.points || 0, // ✅ إضافة
  };
};
