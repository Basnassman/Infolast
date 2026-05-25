import { prisma } from "../../../core/db/prisma";
import { buildMerkleTree } from "../merkle/tree.service";
import { generateAllProofs } from "../merkle/proof.service";
import {
    airdropContractRead,
      airdropContractWrite,
        setMerkleRoot,
        } from "../../../core/blockchain/airdrop.contract";
import { getEligibleUsers } from "./allocation.service";
import {
  wallet,
} from "../../../core/blockchain/provider";

const CHAIN_ID = 11155111;

/**
 * 🔄 Merkle Sync Service
 * Responsible ONLY for:
 * - Building full Merkle Tree
 * - Generating all proofs
 * - Pushing root to smart contract
 * - Syncing eligibility state
 */

export interface MerkleSyncResult {
  success: boolean;
  root: string;
  txHash?: string;
  eligibleCount: number;
  totalAmountWei: string;
  error?: string;
}

/**
 * Build full Merkle tree
 */
export const buildFullMerkleTree = async () => {
  const eligibleUsers = await getEligibleUsers();

  if (eligibleUsers.length === 0) {
    return null;
  }

  const entries =
  eligibleUsers.map(
    (participant) => ({
      userId:
        participant.userId,

      wallet:
        participant.user.wallet.toLowerCase(),

      amount:
        participant.allocationWei,
    })
  );

  const treeResult = buildMerkleTree(entries, CHAIN_ID);

  if (!treeResult) {
    return null;
  }

  return {
    ...treeResult,
    eligibleCount: eligibleUsers.length,
    entries,
  };
};

/**
 * Save all proofs to DB
 */
export const saveAllProofs = async (
  entries: {
  userId: string;
  wallet: string;
  amount: string;
}[]
  root: string
) => {
  const proofs =
    generateAllProofs(entries, CHAIN_ID);

  const operations = [];

  for (const entry of entries) {
    const proofData =
  proofs.get(
    entry.wallet
  );
      await prisma.userMerkleProof.upsert({
  where: {
    userId: entry.userId,
  },

  update: {
    merkleProof:
      proofData?.proof || [],

    merkleLeaf:
      proofData?.leaf || null,

    merkleRoot: root,

    chainId: CHAIN_ID,
  },

  create: {
    userId: entry.userId,

    merkleProof:
      proofData?.proof || [],

    merkleLeaf:
      proofData?.leaf || null,

    merkleRoot: root,

    chainId: CHAIN_ID,
  },
});

  await prisma.$transaction(operations);

  return proofs.size;
};

/**
 * Push Merkle root to contract
 */
export const pushMerkleRootToContract = async (
  root: string,
  totalAmountWei: string
): Promise<string> => {
  const currentRoot = await airdropContractRead.merkleRoot();

  if (currentRoot.toLowerCase() === root.toLowerCase()) {
    throw new Error("Merkle root already set to this value");
  }

const govRole =
  await airdropContractRead.GOVERNANCE_ROLE();

const adminRole =
  await airdropContractRead.DEFAULT_ADMIN_ROLE();

const signer =
  wallet?.address;

const isGov =
  await airdropContractRead.hasRole(
    govRole,
    signer
  );

const isAdmin =
  await airdropContractRead.hasRole(
    adminRole,
    signer
  );

console.log("Signer:", signer);
console.log("Is GOV:", isGov);
console.log("Is ADMIN:", isAdmin);

  const tx = await setMerkleRoot(
    root,
  );

  const receipt = await tx.wait();

  if (!receipt || receipt.status !== 1) {
    throw new Error("Transaction failed");
  }

  return tx.hash;
};

/**
 * Full sync process
 */
export const syncMerkleDistribution =
  async (): Promise<MerkleSyncResult> => {
    try {
      // Step 1: Build tree
      const treeData = await buildFullMerkleTree();

      if (!treeData) {
        return {
          success: false,
          root: "0x0",
          eligibleCount: 0,
          totalAmountWei: "0",
          error: "No eligible users found",
        };
      }

      const {
        root,
        entries,
        eligibleCount,
      } = treeData;

      // Step 2: Calculate total amount
      const totalAmountWei = entries
        .reduce(
          (sum, e) => sum + BigInt(e.amount),
          BigInt(0)
        )
        .toString();

      // Step 3: Save proofs
      await saveAllProofs(entries, root);

      // Step 4: Push root to contract
      let txHash: string | undefined;

      try {
        txHash = await pushMerkleRootToContract(
          root,
          totalAmountWei
        );
      } catch (contractError: any) {
        if (
          contractError.message.includes(
            "already set"
          )
        ) {
          txHash = "already_set";
        } else {
          throw contractError;
        }
      }

      // Step 5: Update state
      await prisma.airdropState.upsert({
        where: { id: "1" },
        update: {
          merkleRoot: root,
          totalEligible: eligibleCount,
          totalAmountWei,
          lastSyncedAt: new Date(),
          syncTxHash: txHash,
          status: "SYNCED",
          errorMessage: null,
        },
        create: {
          id: "1",
          merkleRoot: root,
          totalEligible: eligibleCount,
          totalAmountWei,
          lastSyncedAt: new Date(),
          syncTxHash: txHash,
          status: "SYNCED",
        },
      });

      return {
        success: true,
        root,
        txHash,
        eligibleCount,
        totalAmountWei,
      };
    } catch (error: any) {
      await prisma.airdropState.upsert({
        where: { id: "1" },
        update: {
          status: "FAILED",
          errorMessage: error.message,
          lastSyncedAt: new Date(),
        },
        create: {
          id: "1",
          status: "FAILED",
          errorMessage: error.message,
        },
      });

      return {
        success: false,
        root: "0x0",
        eligibleCount: 0,
        totalAmountWei: "0",
        error: error.message,
      };
    }
  };

/**
 * Get contract Merkle root
 */
export const getContractMerkleRoot =
  async (): Promise<string> => {
    return await airdropContractRead.merkleRoot();
  };

/**
 * Get sync status
 */
export const getSyncStatus = async () => {
  const state =
    await prisma.airdropState.findUnique({
      where: { id: "1" },
    });

  const contractRoot =
    await getContractMerkleRoot();

  return {
    dbRoot: state?.merkleRoot || "0x0",
    contractRoot,
    inSync:
      state?.merkleRoot?.toLowerCase() ===
      contractRoot.toLowerCase(),
    lastSyncedAt: state?.lastSyncedAt,
    totalEligible: state?.totalEligible || 0,
    totalAmountWei:
      state?.totalAmountWei || "0",
    status: state?.status || "PENDING",
    errorMessage: state?.errorMessage,
  };
};