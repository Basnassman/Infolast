import { prisma } from "../../../core/db/prisma";

import {
  ClaimStatus,
  DistributionType,
  MerkleRootStatus,
} from "@prisma/client";

export const getActiveMerkleRoot =
  async () => {
    return prisma.merkleRoot.findFirst({
      where: {
        distributionType:
          DistributionType.AIRDROP,

        status:
          MerkleRootStatus.ACTIVE,
      },

      orderBy: {
        createdAt: "desc",
      },
    });
  };

export const getProofByWallet =
  async (
    merkleRootId: string,
    walletAddress: string
  ) => {
    return prisma.merkleProof.findFirst({
      where: {
        merkleRootId,

        walletAddress:
          walletAddress.toLowerCase(),
      },
    });
  };

export const getUserClaims =
  async (userId: string) => {
    return prisma.distributionClaim.findMany({
      where: {
        userId,
      },

      orderBy: {
        createdAt: "desc",
      },
    });
  };

export const getClaimByTx =
  async (txHash: string) => {
    return prisma.distributionClaim.findUnique({
      where: {
        txHash,
      },
    });
  };

export const createClaim =
  async (data: {
    userId: string;
    merkleRootId: string;
    txHash: string;
    amountWei: string;
  }) => {
    return prisma.distributionClaim.create({
      data: {
        userId: data.userId,

        merkleRootId:
          data.merkleRootId,

        distributionType:
          DistributionType.AIRDROP,

        txHash: data.txHash,

        amountWei:
          data.amountWei,

        status:
          ClaimStatus.PENDING,
      },
    });
  };

export const markClaimCompleted =
  async (
    claimId: string,
    txHash: string
  ) => {
    return prisma.distributionClaim.update({
      where: {
        id: claimId,
      },

      data: {
        txHash,

        status:
          ClaimStatus.COMPLETED,

        claimedAt:
          new Date(),
      },
    });
  };

export const markClaimFailed =
  async (
    claimId: string,
    reason: string
  ) => {
    return prisma.distributionClaim.update({
      where: {
        id: claimId,
      },

      data: {
        status:
          ClaimStatus.FAILED,

        errorMessage:
          reason,
      },
    });
  };
