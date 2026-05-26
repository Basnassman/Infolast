import { prisma } from "@core/db/prisma";
import { DistributionType } from "@prisma/client";

export const createMerkleRoot = async (data: {
  root: string;
  eligibleCount: number;
  totalAmountWei: string;
  txHash?: string | null;
  ipfsSnapshotUrl?: string | null;
}) => {
  await prisma.merkleRoot.updateMany({
    where: {
      distributionType: DistributionType.AIRDROP,
      isActive: true,
    },
    data: {
      isActive: false,
    },
  });

  return prisma.merkleRoot.create({
    data: {
      distributionType: DistributionType.AIRDROP,
      root: data.root,
      eligibleCount: data.eligibleCount,
      totalAmountWei: data.totalAmountWei,
      txHash: data.txHash ?? null,
      ipfsSnapshotUrl: data.ipfsSnapshotUrl ?? null,
      isActive: true,
    },
  });
};

export const updateMerkleRootTxHash = async (
  merkleRootId: string,
  txHash: string
) => {
  return prisma.merkleRoot.update({
    where: {
      id: merkleRootId,
    },
    data: {
      txHash,
    },
  });
};

export const getActiveMerkleRoot = async () => {
  return prisma.merkleRoot.findFirst({
    where: {
      distributionType: DistributionType.AIRDROP,
      isActive: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
};

export const findMerkleRootByRoot = async (
  root: string
) => {
  return prisma.merkleRoot.findUnique({
    where: {
      root,
    },
  });
};