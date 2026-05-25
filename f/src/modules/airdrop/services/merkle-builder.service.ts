import { buildMerkleTree, MerkleTreeResult } from "../merkle/tree.service";
import { ProofResult } from "../merkle/proof.service";
import { prisma } from "../../../core/db/prisma";

const CHAIN_ID = 11155111; // Sepolia

/**
 * Build Merkle tree from eligible users in database
 */
export const buildTreeFromDb = async (): Promise<MerkleTreeResult | null> => {
  const eligibleUsers = await prisma.user.findMany({
    where: { airdropPoints: { gt: 0 }, isBlocked: false },
  });

  if (eligibleUsers.length === 0) return null;

  const entries = eligibleUsers.map((u) => ({
    wallet: u.wallet,
    amount: u.airdropAllocated.toString(),
  }));

  return buildMerkleTree(entries, CHAIN_ID);
};

/**
 * Get proof for a specific wallet from database
 */
export const getProofFromDb = async (wallet: string): Promise<ProofResult | null> => {
  const proof = await prisma.userMerkleProof.findUnique({
    where: { wallet: wallet.toLowerCase() },
  });

  if (!proof || !proof.merkleProof || proof.merkleProof.length === 0) {
    return null;
  }

  return {
    leaf: proof.merkleLeaf,
    proof: proof.merkleProof,
    root: "", // Root should be fetched from contract or state
  };
};
