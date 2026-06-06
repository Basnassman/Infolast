// استبدل الملف كاملاً بهذا:
import { airdropReadContract } from "@core/blockchain/contracts/airdrop-read.contract";
import { airdropAdminContract } from "@core/blockchain/contracts/airdrop-admin.contract";

export const airdropContractRead = airdropReadContract;
export const airdropContractWrite = airdropAdminContract;

export const setMerkleRoot = async (
  root: string,
  start: number,
  end: number,
  cap: bigint
) => {
  return airdropAdminContract.setMerkleRoot(root, start, end, cap);
};