import { prisma } from "@core/db/prisma";
import {
  ClaimStatus,
  DistributionType,
} from "@prisma/client";

// =====================================================
// MERKLE ROOT
// =====================================================

export const getActiveMerkleRoot = async () => {
  return prisma.merkleRoot.findFirst({
    where: {
      distributionType: DistributionType.AIRDROP,
      isActive: true, // ✅ isActive (Boolean) وليس status
    },
    orderBy: {
      createdAt: "desc",
    },
  });
};

// =====================================================
// MERKLE PROOF
// =====================================================

export const getProofByWallet = async (
  merkleRootId: string,
  walletAddress: string
) => {
  return prisma.merkleProof.findFirst({
    where: {
      merkleRootId,
      walletAddress: walletAddress.toLowerCase(),
    },
  });
};

// =====================================================
// DISTRIBUTION CLAIMS
// =====================================================

export const getUserClaims = async (userId: string) => {
  return prisma.distributionClaim.findMany({
    where: { userId },
    orderBy: {
      createdAt: "desc",
    },
  });
};

// ✅ تغيير من findUnique إلى findFirst لأن txHash ليس unique
export const getClaimByTx = async (txHash: string) => {
  return prisma.distributionClaim.findFirst({
    where: { txHash },
  });
};

// ✅ إزالة merkleRootId وإضافة airdropParticipantId
export const createClaim = async (data: {
  userId: string;
  airdropParticipantId: string;
  txHash: string;
  amountWei: string;
}) => {
  return prisma.distributionClaim.create({
    data: {
      userId: data.userId,
      airdropParticipantId: data.airdropParticipantId, // ✅ بدلاً من merkleRootId
      distributionType: DistributionType.AIRDROP,
      txHash: data.txHash,
      amountWei: data.amountWei,
      status: ClaimStatus.PENDING,
    },
  });
};

// ✅ status يصبح CLAIMED وليس COMPLETED
export const markClaimClaimed = async (
  claimId: string,
  txHash: string
) => {
  return prisma.distributionClaim.update({
    where: { id: claimId },
    data: {
      txHash,
      status: ClaimStatus.CLAIMED, // ✅ CLAIMED وليس COMPLETED
      claimedAt: new Date(),
    },
  });
};

// ✅ إزالة errorMessage غير الموجودة
export const markClaimFailed = async (claimId: string) => {
  return prisma.distributionClaim.update({
    where: { id: claimId },
    data: {
      status: ClaimStatus.FAILED,
      // ❌ errorMessage محذوفة - غير موجودة في schema
    },
  });
};
