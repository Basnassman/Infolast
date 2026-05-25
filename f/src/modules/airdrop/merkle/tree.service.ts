import { MerkleTree } from "merkletreejs";
import keccak256 from "keccak256";
import { hashLeaf } from "./hash.service";

export interface AirdropEntry {
  wallet: string;
  amount: string | number | bigint;
}

export interface MerkleTreeResult {
  root: string;
  tree: MerkleTree;
  leaves: { wallet: string; amount: string; leaf: string }[];
}

/**
 * 🌳 Pure Merkle Tree Builder
 * No DB side effects - takes entries, returns tree
 */
export const buildMerkleTree = (
  data: AirdropEntry[],
  chainId: number = 11155111
): MerkleTreeResult | null => {
  if (data.length === 0) return null;

  const leaves = data.map((entry) => {
    const leaf = hashLeaf(entry.wallet, entry.amount, chainId);
    return {
      wallet: entry.wallet.toLowerCase(),
      amount: BigInt(entry.amount).toString(),
      leaf,
    };
  });

  const leafHashes = leaves.map((l) => Buffer.from(l.leaf.slice(2), "hex"));

  const tree = new MerkleTree(leafHashes, keccak256, {
    sortPairs: true,
    hashLeaves: false, // We already hash leaves
  });

  const root = "0x" + tree.getRoot().toString("hex");

  return {
    root,
    tree,
    leaves,
  };
};

/**
 * Verify a Merkle proof
 */
export const verifyProof = (
  root: string,
  leaf: string,
  proof: string[]
): boolean => {
  const leafBuffer = Buffer.from(leaf.slice(2), "hex");
  const proofBuffers = proof.map((p) => Buffer.from(p.slice(2), "hex"));

  return MerkleTree.verify(
    proofBuffers,
    leafBuffer,
    Buffer.from(root.slice(2), "hex"),
    keccak256,
    {
      sortPairs: true,
    }
  );
};