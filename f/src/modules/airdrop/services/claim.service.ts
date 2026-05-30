export const getClaimStatus = async (walletAddress: string) => {
  const normalized = walletAddress.toLowerCase();
  const validation = await validateClaim(normalized);

  const user = await prisma.user.findUnique({
    where: { walletAddress: normalized },
    select: { id: true },
  });

  if (!user) return { eligible: false };

  const claims = await prisma.distributionClaim.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  // ✅ إضافة: جلب النقاط
  const participant = await prisma.airdropParticipant.findUnique({
    where: { userId: user.id },
    select: { points: true },
  });

  return {
    eligible: validation.valid,
    amountWei: validation.amountWei || "0",
    points: participant?.points || 0, // ✅ إضافة
    proof: validation.proof || [],
    claims,
  };
};
