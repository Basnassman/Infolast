export type NormalizeMerkleProofInput =
  {
    walletAddress: string;

    allocationWei: string;

    merkleRoot: string;

    merkleProof: string[];

    leaf: string;
  };

export type NormalizeMerkleRootInput =
  {
    id: string;

    root: string;

    totalAmountWei: string;

    eligibleCount: number;

    txHash: string | null;

    createdAt: Date;
  };

export const normalizeMerkleProof =
  (
    proof: NormalizeMerkleProofInput
  ) => {
    return {
      walletAddress:
        proof.walletAddress,

      allocationWei:
        proof.allocationWei,

      merkleRoot:
        proof.merkleRoot,

      proof:
        proof.merkleProof,

      leaf:
        proof.leaf,
    };
  };

export const normalizeMerkleRoot =
  (
    root: NormalizeMerkleRootInput
  ) => {
    return {
      id: root.id,

      root: root.root,

      totalAmountWei:
        root.totalAmountWei,

      eligibleCount:
        root.eligibleCount,

      txHash:
        root.txHash,

      createdAt:
        root.createdAt,
    };
  };