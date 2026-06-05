import { prisma } from "@core/db/prisma";
import { DistributionType } from "@prisma/client";

export const createMerkleRoot = async (data: {
  root: string;
  eligibleCount: number;
  totalAmountWei: string;
  txHash?: string | null;
  ipfsSnapshotUrl?: string | null;
}) => {

  const existing =
    await prisma.merkleRoot.findUnique({
      where: {
        root: data.root,
      },
    });

  if (existing) {
    if (!existing.isActive) {

      await prisma.merkleRoot.updateMany({
        where: {
          distributionType: DistributionType.AIRDROP,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });

      return prisma.merkleRoot.update({
        where: {
          id: existing.id,
        },
        data: {
          isActive: true,
        },
      });
    }

    return existing;
  }

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
    where: { id: merkleRootId },
    data: { txHash },             // ✅ String?
  });
};

export const getActiveMerkleRoot = async () => {
  return prisma.merkleRoot.findFirst({
    where: {
      distributionType: DistributionType.AIRDROP,
      isActive: true,             // ✅ Boolean
    },
    orderBy: { createdAt: "desc" },
  });
};

export const findMerkleRootByRoot = async (root: string) => {
  return prisma.merkleRoot.findUnique({
    where: { root },              // ✅ @unique
  });
};
