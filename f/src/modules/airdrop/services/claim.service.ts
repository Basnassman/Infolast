import { createClaim } from "@modules/airdrop/repositories/claim.repository";
import { validateClaim } from "@modules/airdrop/services/claim-validation.service";
import { syncClaimTransaction } from "@modules/airdrop/services/claim-sync.service";
import { prisma } from "@core/db/prisma";

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

  return {
    eligible: validation.valid,
    amountWei: validation.amountWei || "0",
    proof: validation.proof || [],
    claims,
  };
};

export const recordClaim = async (walletAddress: string, txHash: string) => {
  const validation = await validateClaim(walletAddress);

  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  const user = await prisma.user.findUnique({
    where: { walletAddress: walletAddress.toLowerCase() },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // ✅ إصلاح: استخدام airdropParticipantId بدلاً من merkleRootId
  const airdropParticipant = await prisma.airdropParticipant.findUnique({
    where: { userId: user.id },
  });

  if (!airdropParticipant) {
    throw new Error("Airdrop participant not found");
  }

  const claim = await createClaim({
    userId: user.id,
    airdropParticipantId: airdropParticipant.id, // ✅ تم التعديل
    txHash,
    amountWei: validation.amountWei!,
  });

  await syncClaimTransaction(claim.id, txHash);

  return claim;
};
