import { prisma } from "@core/db/prisma";
import { ClaimStatus, DistributionType } from "@prisma/client";

export const getUserClaims = async (userId: string) => {
  return prisma.distributionClaim.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
};

export const getClaimByTx = async (txHash: string) => {
  return prisma.distributionClaim.findFirst({
    where: { txHash },
  });
};

export const createClaim = async (data: {
  userId: string;
  airdropParticipantId: string;
  txHash: string;
  amountWei: string;
}) => {
  return prisma.distributionClaim.create({
    data: {
      userId: data.userId,
      airdropParticipantId: data.airdropParticipantId,
      distributionType: DistributionType.AIRDROP,
      txHash: data.txHash,
      amountWei: data.amountWei,
      status: ClaimStatus.PENDING,
    },
  });
};

export const markClaimClaimed = async (claimId: string, txHash: string) => {
  return prisma.distributionClaim.update({
    where: { id: claimId },
    data: {
      txHash,
      status: ClaimStatus.CLAIMED,
      claimedAt: new Date(),
    },
  });
};

export const markClaimFailed = async (claimId: string) => {
  return prisma.distributionClaim.update({
    where: { id: claimId },
    data: {
      status: ClaimStatus.FAILED,
    },
  });
};
