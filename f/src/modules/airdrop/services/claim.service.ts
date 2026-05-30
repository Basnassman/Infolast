import { createClaim } from "@modules/airdrop/repositories/claim.repository";
import { validateClaim } from "@modules/airdrop/services/claim-validation.service";
import { syncClaimTransaction } from "@modules/airdrop/services/claim-sync.service";
import { prisma } from "@core/db/prisma";


export interface ClaimStatusResult {
  eligible: boolean;
  amountWei: string;
  points: number;
  proof: string[];
  claims: any[];
}

export const getClaimStatus = async (walletAddress: string): Promise<ClaimStatusResult> => {
  const normalized = walletAddress.toLowerCase();
  const validation = await validateClaim(normalized);

  const user = await prisma.user.findUnique({
    where: { walletAddress: normalized },
    select: { id: true },
  });

  if (!user) {
    return {
      eligible: false,
      amountWei: "0",
      points: 0,
      proof: [],
      claims: [],
    };
  }

  const claims = await prisma.distributionClaim.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  const participant = await prisma.airdropParticipant.findUnique({
    where: { userId: user.id },
    select: { points: true },
  });

  return {
    eligible: validation.valid,
    amountWei: validation.amountWei || "0",
    points: participant?.points || 0,
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

  const airdropParticipant = await prisma.airdropParticipant.findUnique({
    where: { userId: user.id },
  });

  if (!airdropParticipant) {
    throw new Error("Airdrop participant not found");
  }

  const claim = await createClaim({
    userId: user.id,
    airdropParticipantId: airdropParticipant.id,
    txHash,
    amountWei: validation.amountWei!,
  });

  await syncClaimTransaction(claim.id, txHash);

  return claim;
};
