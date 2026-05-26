import { z } from "zod";

export const proofRequestSchema =
  z.object({
    walletAddress:
      z
        .string()
        .trim()
        .toLowerCase()
        .startsWith("0x")
        .length(42),
  });

export type ProofRequestDto =
  z.infer<
    typeof proofRequestSchema
  >;

export const merkleProofSchema =
  z.object({
    walletAddress:
      z.string(),

    allocationWei:
      z.string(),

    merkleProof:
      z.array(z.string()),

    merkleLeaf:
      z.string(),

    merkleRoot:
      z.string(),
  });

export type MerkleProofDto =
  z.infer<
    typeof merkleProofSchema
  >;