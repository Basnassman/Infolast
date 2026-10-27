import { prisma } from "@core/db/prisma";
import { DistributionType, MerkleJobStatus, UserStatus } from "@prisma/client";
import { logger } from "@core/logger/logger";
import { recalculateAllocations } from "@modules/airdrop/services/allocation.service";
import { getEligibleParticipants } from "@modules/airdrop/services/participant.service";
import { buildMerkleTree, AirdropEntry } from "@modules/airdrop/merkle/tree.service";
import { pushMerkleRoot } from "@modules/airdrop/services/merkle-sync.service";
import { isRebuildNeeded } from "@modules/airdrop/services/rebuild-check.service";
import { createMerkleRoot, updateMerkleRootTxHash } from "@modules/airdrop/repositories/merkle-root.repository";
import { saveMerkleProofs } from "@modules/airdrop/repositories/merkle-proof.repository";
import { env } from "@core/config/env";

/**
 * Counts at every eligibility stage (no wallet addresses — privacy safe).
 * Used to distinguish "there are genuinely no participants" from
 * "something upstream (points / eligibility / sync) is broken".
 */
export interface EligibilityDiagnostics {
  totalParticipants: number;
  activeParticipants: number;
  flaggedEligible: number;
  withPoints: number;
  withNonZeroAllocation: number;
}

const countEligibilityStages = async (): Promise<EligibilityDiagnostics> => {
  const activeUser = { user: { status: UserStatus.ACTIVE } };

  const [
    totalParticipants,
    activeParticipants,
    flaggedEligible,
    withPoints,
    withNonZeroAllocation,
  ] = await Promise.all([
    prisma.airdropParticipant.count(),
    prisma.airdropParticipant.count({ where: activeUser }),
    prisma.airdropParticipant.count({
      where: { ...activeUser, isEligible: true },
    }),
    prisma.airdropParticipant.count({
      where: { ...activeUser, isEligible: true, points: { gt: 0 } },
    }),
    prisma.airdropParticipant.count({
      where: {
        ...activeUser,
        isEligible: true,
        points: { gt: 0 },
        allocationWei: { not: "0" },
      },
    }),
  ]);

  return {
    totalParticipants,
    activeParticipants,
    flaggedEligible,
    withPoints,
    withNonZeroAllocation,
  };
};

export interface RebuildResult {
  success: boolean;
  skipped?: boolean;
  root?: string;
  txHash?: string;
  eligibleCount?: number;
  totalAmountWei?: string;
  error?: string;
}

/**
 * 🏗️ Build Merkle snapshot from participants
 * 
 * Converts Prisma AirdropParticipant[] → AirdropEntry[]
 * then builds the Merkle tree
 */
const buildMerkleSnapshot = (
  participants: Array<{
    user: { walletAddress: string };
    allocationWei: string;
  }>
): {
  root: string;
  eligibleCount: number;
  totalAmountWei: string;
  proofs: Array<{
    walletAddress: string;
    proof: string[];
    leaf: string;
    amountWei: string;
  }>;
} => {
  // ✅ تحويل إلى AirdropEntry (walletAddress + amountWei)
  const entries: AirdropEntry[] = participants.map((p) => ({
    walletAddress: p.user.walletAddress,
    amountWei: p.allocationWei,
  }));

  const result = buildMerkleTree(entries);

  if (!result) {
    throw new Error("Failed to build Merkle tree");
  }

  const totalAmountWei = result.leaves.reduce(
    (sum, leaf) => sum + BigInt(leaf.amount),
    0n
  );

  // ✅ تحويل الإثباتات إلى تنسيق مطابق لـ saveMerkleProofs
  const proofs = result.leaves.map((leaf) => {
    // الحصول على الإثبات من الشجرة
    const leafBuffer = Buffer.from(leaf.leaf.slice(2), "hex");
    const proofBuffers = result.tree.getProof(leafBuffer);
    const proof = proofBuffers.map(
      (p: any) => "0x" + p.data.toString("hex")
    );

    return {
      walletAddress: leaf.walletAddress.toLowerCase(),
      proof,
      leaf: leaf.leaf,
      amountWei: leaf.amount,
    };
  });

  return {
    root: result.root,
    eligibleCount: participants.length,
    totalAmountWei: totalAmountWei.toString(),
    proofs,
  };
};

export const rebuildAndSync = async (): Promise<RebuildResult> => {
  const startedAt = new Date();

  const job = await prisma.merkleJob.create({
    data: {
      distributionType: DistributionType.AIRDROP,
      status: MerkleJobStatus.PROCESSING,
      startedAt,
    },
  });

  try {
    // 1️⃣ recalculate allocations
    const recalculation = await recalculateAllocations();

    // 2️⃣ fetch participants
    const candidates = await getEligibleParticipants();

    // Points below the allocation rate produce a zero allocation; those
    // leaves must never reach the Merkle tree.
    const participants = candidates.filter((participant) => {
      try {
        return BigInt(participant.allocationWei) > 0n;
      } catch {
        return false;
      }
    });

    const droppedZeroAllocation = candidates.length - participants.length;

    if (participants.length === 0) {
      const diagnostics = await countEligibilityStages();

      logger.error(
        { diagnostics, recalculation, droppedZeroAllocation },
        "[Merkle] No eligible participants — eligibility stage diagnostics"
      );

      throw new Error(
        "No eligible participants found " +
          `(participants=${diagnostics.totalParticipants}, ` +
          `active=${diagnostics.activeParticipants}, ` +
          `flaggedEligible=${diagnostics.flaggedEligible}, ` +
          `withPoints=${diagnostics.withPoints}, ` +
          `withAllocation=${diagnostics.withNonZeroAllocation}). ` +
          "See the [Merkle] diagnostics log entry for the failing stage."
      );
    }

    if (droppedZeroAllocation > 0) {
      logger.warn(
        { droppedZeroAllocation, eligible: participants.length },
        "[Merkle] Skipped participants with a zero allocation"
      );
    }

    logger.info(
      {
        eligible: participants.length,
        droppedZeroAllocation,
        totalAllocationWei: recalculation.totalAmountWei,
      },
      "[Merkle] Building snapshot"
    );

    // 3️⃣ build snapshot ✅ (مُضمَّن الآن في نفس الملف)
    const snapshot = buildMerkleSnapshot(participants);

    // 4️⃣ create root
    const merkleRoot = await createMerkleRoot({
      root: snapshot.root,
      eligibleCount: snapshot.eligibleCount,
      totalAmountWei: snapshot.totalAmountWei,
    });

    // 5️⃣ save proofs ✅ (مطابق لـ saveMerkleProofs)
    await saveMerkleProofs(merkleRoot.id, snapshot.proofs);

    // 6️⃣ push root onchain
    const now = Math.floor(Date.now() / 1000);
    const claimStart = env.airdrop.claimStart || now;
    const claimEnd = env.airdrop.claimEnd;
    const cap = BigInt(env.airdrop.claimCapWei ?? snapshot.totalAmountWei);
    const txHash = await pushMerkleRoot(snapshot.root, claimStart, claimEnd, cap);

    // 7️⃣ update tx hash
    if (txHash !== "already_synced") {
      await updateMerkleRootTxHash(merkleRoot.id, txHash);
    }

    // 8️⃣ complete job
    await prisma.merkleJob.update({
      where: { id: job.id },
      data: {
        status: MerkleJobStatus.COMPLETED,
        completedAt: new Date(),
        merkleRootId: merkleRoot.id,
        txHash: txHash === "already_synced" ? null : txHash,
        eligibleCount: snapshot.eligibleCount,
        totalAmountWei: snapshot.totalAmountWei,
      },
    });

    return {
      success: true,
      root: snapshot.root,
      txHash,
      eligibleCount: snapshot.eligibleCount,
      totalAmountWei: snapshot.totalAmountWei,
    };
  } catch (error: any) {
    await prisma.merkleJob.update({
      where: { id: job.id },
      data: {
        status: MerkleJobStatus.FAILED,
        completedAt: new Date(),
        error: error.message,
      },
    });

    return {
      success: false,
      error: error.message,
    };
  }
};

export const cronRebuild = async (): Promise<RebuildResult> => {
  const needed = await isRebuildNeeded();

  if (!needed) {
    return { success: true, skipped: true };
  }

  return rebuildAndSync();
};
