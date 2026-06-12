import { MerkleTree } from "merkletreejs";
import keccak256 from "keccak256";
import { hashLeaf } from "@modules/airdrop/merkle/hash.service";
import { validateUniqueWallets } from "@modules/airdrop/utils/validate-unique-wallets";
import { normalizeWallet } from "@shared/utils/wallet";

const DEFAULT_CHAIN_ID = 11155111;

export interface AirdropEntry {
  walletAddress: string;
  amountWei: string | number | bigint;
}

export interface MerkleLeafNode {
  walletAddress: string;
  amount: string;
  leaf: string;
}

export interface MerkleTreeResult {
  root: string;
  tree: MerkleTree;
  leaves: MerkleLeafNode[];
}

export const buildMerkleTree = (
  entries: AirdropEntry[],
  chainId: number = DEFAULT_CHAIN_ID
): MerkleTreeResult | null => {
  if (!entries.length) return null;

  validateUniqueWallets(entries);

  const leaves: MerkleLeafNode[] = entries.map((entry) => {
    const normalizedWallet = normalizeWallet(entry.walletAddress);
    const normalizedAmount = BigInt(entry.amountWei).toString();
    const leaf = hashLeaf(normalizedWallet, normalizedAmount, chainId);

    return {
      walletAddress: normalizedWallet,
      amount: normalizedAmount,
      leaf,
    };
  });

  const leafBuffers = leaves.map((leaf) => Buffer.from(leaf.leaf.slice(2), "hex"));

  const tree = new MerkleTree(leafBuffers, keccak256, {
    sortPairs: true,
    hashLeaves: false,
  });

  const root = "0x" + tree.getRoot().toString("hex");

  return { root, tree, leaves };
};

export const verifyProof = (root: string, leaf: string, proof: string[]): boolean => {
  const leafBuffer = Buffer.from(leaf.slice(2), "hex");
  const proofBuffers = proof.map((p) => Buffer.from(p.slice(2), "hex"));

  return MerkleTree.verify(
    proofBuffers,
    leafBuffer,
    Buffer.from(root.slice(2), "hex"),
    keccak256,
    { sortPairs: true }
  );
};
