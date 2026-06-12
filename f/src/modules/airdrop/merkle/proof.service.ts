import { hashLeaf } from "@modules/airdrop/merkle/hash.service";
import { buildMerkleTree, AirdropEntry } from "@modules/airdrop/merkle/tree.service";
import { validateUniqueWallets } from "../utils/validate-unique-wallets";
import { normalizeWallet } from "@shared/utils/wallet";

const DEFAULT_CHAIN_ID = 11155111;

export interface ProofResult {
  leaf: string;
  proof: string[];
  root: string;
}

export const generateProof = (
  wallet: string,
  amount: string | number | bigint,
  allEntries: AirdropEntry[],
  chainId: number = DEFAULT_CHAIN_ID
): ProofResult | null => {
  validateUniqueWallets(allEntries);

  const result = buildMerkleTree(allEntries, chainId);
  if (!result) return null;

  const { tree, root } = result;

  const normalizedWallet = normalizeWallet(wallet);
  const leaf = hashLeaf(normalizedWallet, amount, chainId);
  const leafBuffer = Buffer.from(leaf.slice(2), "hex");

  const proof = tree
    .getProof(leafBuffer)
    .map((p: any) => "0x" + p.data.toString("hex"));

  return { leaf, proof, root };
};

export const generateAllProofs = (
  allEntries: AirdropEntry[],
  chainId: number = DEFAULT_CHAIN_ID
): Map<string, ProofResult> => {
  validateUniqueWallets(allEntries);

  const result = buildMerkleTree(allEntries, chainId);
  if (!result) return new Map();

  const { tree, root } = result;

  const proofs = new Map<string, ProofResult>();

  for (const entry of allEntries) {
    const normalizedWallet = normalizeWallet(entry.walletAddress); // ✅ إصلاح: walletAddress
    const leaf = hashLeaf(normalizedWallet, entry.amountWei, chainId); // ✅ إصلاح: amountWei
    const leafBuffer = Buffer.from(leaf.slice(2), "hex");

    const proof = tree
      .getProof(leafBuffer)
      .map((p: any) => "0x" + p.data.toString("hex"));

    proofs.set(normalizedWallet, { leaf, proof, root });
  }

  return proofs;
};
