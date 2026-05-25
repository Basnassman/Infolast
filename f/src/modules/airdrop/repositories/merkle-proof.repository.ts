import { prisma } from "../../../core/db/prisma";

export const saveMerkleProofs = async (
  merkleRootId: string,
  proofs: {
    walletAddress: string;
    proof: string[];
    leaf: string;
    amountWei: string;
  }[]
) => {
  if (proofs.length === 0) {
    return;
  }

  await prisma.merkleProof.createMany({
    data: proofs.map((proof) => ({
      merkleRootId,
      walletAddress: proof.walletAddress,
      proof: proof.proof,
      leaf: proof.leaf,
      amountWei: proof.amountWei,
    })),
  });
};

export const getWalletProof = async (
  walletAddress: string
) => {
  return prisma.merkleProof.findFirst({
    where: {
      walletAddress: walletAddress.toLowerCase(),
      merkleRoot: {
        isActive: true,
      },
    },
    include: {
      merkleRoot: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
};