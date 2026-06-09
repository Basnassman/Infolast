import { buildMerkleTree, AirdropEntry,} from "@modules/airdrop/merkle/tree.service";
import { generateAllProofs, } from "@modules/airdrop/merkle/proof.service";
import { AirdropParticipantView,} from "@modules/airdrop/domain/airdrop.types";
import { MerkleProofGenerationError } from "@modules/airdrop/errors/merkle-proof-generation.error";
import { MerkleTreeBuildError } from "@modules/airdrop/errors/merkle-tree-build.error";

const CHAIN_ID = 11155111;

export interface MerkleSnapshot {
  root: string;

  entries: AirdropEntry[];
  

  proofs: {
    walletAddress: string;
    proofs: string[];
    leaf: string;
    amountWei: string;
  }[];

  totalAmountWei: string;

  eligibleCount: number;
}

export const buildMerkleSnapshot = (
  participants: AirdropParticipantView[]
): MerkleSnapshot => {
  const entries: AirdropEntry[] =
    participants.map((participant) => ({
      walletAddress:
        participant.user.walletAddress.toLowerCase(),

      amountWei:
        participant.allocationWei,
    }));

  const tree =
    buildMerkleTree(
      entries,
      CHAIN_ID
    );

  if (!tree) {
  throw new MerkleTreeBuildError();
  }

  const proofsMap =
    generateAllProofs(
      entries,
      CHAIN_ID
    );

  const proofs = entries.map((entry) => {
    const proof =
      proofsMap.get(
        entry.walletAddress
      );

    if (!proof) {
    throw new MerkleProofGenerationError(
    entry.walletAddress
  );
  }

    return {
      walletAddress: entry.walletAddress,

      proof: proof.proof,

      leaf: proof.leaf,

      amountWei: entry.amountWei,
    };
  });

  const totalAmountWei =
    entries
      .reduce(
        (sum, entry) =>
          sum +
          BigInt(entry.amountWei),0n).toString();

  return {
    root: tree.root,

    entries,

    proofs,

    totalAmountWei,

    eligibleCount:
      entries.length,
  };
};