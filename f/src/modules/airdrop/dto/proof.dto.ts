import { z } from "zod";

export const proofRequestSchema = z.object({
  walletAddress: z
    .string()
    .trim()
    .toLowerCase()
    .startsWith("0x")
    .length(42),
});

export type ProofRequestDto = z.infer<typeof proofRequestSchema>;

// ✅ إصلاح: أسماء الحقول تطابق Prisma MerkleProof
export const merkleProofSchema = z.object({
  id: z.string().optional(),
  merkleRootId: z.string(),
  walletAddress: z.string(),
  proof: z.array(z.string()),        // ✅ كان merkleProof
  leaf: z.string(),                 // ✅ كان merkleLeaf
  amountWei: z.string(),
  createdAt: z.date().optional(),
});

export type MerkleProofDto = z.infer<typeof merkleProofSchema>;
