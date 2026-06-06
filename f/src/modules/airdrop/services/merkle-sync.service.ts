import {
  airdropContractRead,
  setMerkleRoot,
} from "@core/blockchain/airdrop.contract";

export const getCurrentMerkleRoot = async (): Promise<string> => {
  return await airdropContractRead.merkleRoot();
};

export const pushMerkleRoot = async (
  root: string,
  start: number,
  end: number,
  cap: bigint
): Promise<string> => {
  const currentRoot = await getCurrentMerkleRoot();

  if (currentRoot.toLowerCase() === root.toLowerCase()) {
    return "already_synced";
  }

  const tx = await setMerkleRoot(root, start, end, cap);

  const receipt = await tx.wait();

  if (!receipt || receipt.status !== 1) {
    throw new Error("Merkle root transaction failed");
  }

  return tx.hash;
};

export const verifyMerkleRoot = async (expectedRoot: string): Promise<boolean> => {
  const currentRoot = await getCurrentMerkleRoot();
  return currentRoot.toLowerCase() === expectedRoot.toLowerCase();
};