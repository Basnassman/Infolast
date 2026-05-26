import { airdropReadContract } from "@core/blockchain/contracts/airdrop-read.contract";
import { airdropAdminContract } from "@core/blockchain/contracts/airdrop-admin.contract";

export const airdropContractRead = airdropReadContract;
export const airdropContractWrite = airdropAdminContract;

export const setMerkleRoot = async (root: string) => {
  return airdropAdminContract.setMerkleRoot(root);
};
