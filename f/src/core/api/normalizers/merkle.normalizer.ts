// src/core/api/normalizers/merkle.normalizer.ts

export type NormalizeMerkleProofInput = {
  id?: string;
  merkleRootId?: string;
  walletAddress?: string;
  allocationWei?: string;
  merkleRoot?: string;
  merkleProof?: string[];
  proof?: string[]; // ✅ Prisma format
  leaf?: string;
  createdAt?: Date;
};

export type NormalizeMerkleRootInput = {
  id?: string;
  root?: string;
  totalAmountWei?: string;
  eligibleCount?: number;
  txHash?: string | null;
  createdAt?: Date;
};

export const normalizeMerkleProof = (proof: NormalizeMerkleProofInput | any) => {
  // ✅ التحقق من null
  if (!proof) {
    return null;
  }

  return {
    id: proof?.id || null,
    merkleRootId: proof?.merkleRootId || null,
    walletAddress: proof?.walletAddress || null,
    allocationWei: proof?.allocationWei || "0",
    merkleRoot: proof?.merkleRoot || null,
    proof: proof?.merkleProof || proof?.proof || [],
    leaf: proof?.leaf || null,
    createdAt: proof?.createdAt || null,
  };
};

export const normalizeMerkleRoot = (root: NormalizeMerkleRootInput | any) => {
  // ✅ التحقق من null
  if (!root) {
    return null;
  }

  return {
    id: root?.id || null,
    root: root?.root || null,
    totalAmountWei: root?.totalAmountWei || "0",
    eligibleCount: root?.eligibleCount || 0,
    txHash: root?.txHash || null,
    createdAt: root?.createdAt || null,
  };
};
