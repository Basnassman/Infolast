import {
  buildMerkleTree,
  AirdropMerkleEntry,
} from "../merkle/tree.service";

import {
  generateAllProofs,
} from "../merkle/proof.service";

import {
  AirdropParticipantWithUser,
} from "../domain/airdrop.types";

const CHAIN_ID = 11155111;

export interface MerkleSnapshot {
  root: string;

  entries: AirdropMerkleEntry[];

  proofs: {
    walletAddress: string;
    proof: string[];
    leaf: string;
    amountWei: string;
  }[];

  totalAmountWei: string;

  eligibleCount: number;
}

export const buildMerkleSnapshot = (
  participants: AirdropParticipantWithUser[]
): MerkleSnapshot => {
  const entries: AirdropMerkleEntry[] =
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
    throw new Error(
      "Unable to build Merkle tree"
    );
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
      throw new Error(
        `Missing proof for ${entry.walletAddress}`
      );
    }

    return {
      walletAddress:
        entry.walletAddress,

      proof:
        proof.proof,

      leaf:
        proof.leaf,

      amountWei:
        entry.amountWei,
    };
  });

  const totalAmountWei =
    entries
      .reduce(
        (sum, entry) =>
          sum +
          BigInt(entry.amountWei),
        0n
      )
      .toString();

  return {
    root: tree.root,

    entries,

    proofs,

    totalAmountWei,

    eligibleCount:
      entries.length,
  };
};