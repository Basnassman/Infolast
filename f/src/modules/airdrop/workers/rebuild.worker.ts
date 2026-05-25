import { prisma } from "../../../core/db/prisma";
import { batchUpdateAllocations } from "../services/allocation.service";
import { syncMerkleDistribution } from "../services/contract-sync.service";

/**
 * 🌳 Merkle Worker
 * 
 * Responsible for:
 * - Batch rebuild of Merkle Tree
 * - Generate all proofs
 * - Sync merkle root to contract
 * - Batch processing of thousands of users
 * 
 * Triggered by:
 * - Cron Job (e.g., every hour)
 * - Manual Admin Trigger
 * 
 * NEVER called by Task Worker or Reward Service
 */

export interface MerkleRebuildResult {
  success: boolean;
  jobId: string;
  root?: string;
  txHash?: string;
  eligibleCount?: number;
  totalAmountWei?: string;
  durationMs?: number;
  error?: string;
}

/**
 * Rebuild Merkle tree and sync to contract
 * Main batch operation
 */
export const rebuildAndSync = async (): Promise<MerkleRebuildResult> => {
  const startTime = Date.now();

  // Create job record
  const job = await prisma.merkleJob.create({
    data: {
      status: "PROCESSING",
      startedAt: new Date(),
    },
  });

  try {
    // Step 1: Update all allocations (points → tokens)
    console.log(`[MerkleWorker] Updating allocations...`);
    const allocationResult = await batchUpdateAllocations();
    console.log(
      `[MerkleWorker] Updated ${allocationResult.updated} allocations`
    );

    // Step 2: Build tree, generate proofs, push to contract
    console.log(`[MerkleWorker] Building Merkle tree...`);
    const syncResult = await syncMerkleDistribution();

    if (!syncResult.success) {
      throw new Error(syncResult.error || "Sync failed");
    }

    const durationMs = Date.now() - startTime;

    // Update job record
    await prisma.merkleJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        root: syncResult.root,
        txHash: syncResult.txHash,
        eligibleCount: syncResult.eligibleCount,
        totalAmountWei: syncResult.totalAmountWei,
      },
    });

    console.log(
      `[MerkleWorker] ✅ Completed in ${durationMs}ms | Root: ${syncResult.root} | Eligible: ${syncResult.eligibleCount}`
    );

    return {
      success: true,
      jobId: job.id,
      root: syncResult.root,
      txHash: syncResult.txHash,
      eligibleCount: syncResult.eligibleCount,
      totalAmountWei: syncResult.totalAmountWei,
      durationMs,
    };
  } catch (error: any) {
    const durationMs = Date.now() - startTime;

    // Update job record with error
    await prisma.merkleJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        error: error.message,
      },
    });

    console.error(`[MerkleWorker] ❌ Failed: ${error.message}`);

    return {
      success: false,
      jobId: job.id,
      durationMs,
      error: error.message,
    };
  }
};

/**
 * Get latest Merkle job status
 */
export const getLatestJobStatus = async () => {
  const latestJob = await prisma.merkleJob.findFirst({
    orderBy: { createdAt: "desc" },
  });

  return latestJob;
};

/**
 * Get job history
 */
export const getJobHistory = async (limit: number = 10) => {
  return await prisma.merkleJob.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
};

/**
 * Check if rebuild is needed
 * Returns true if points have changed since last sync
 */
export const isRebuildNeeded = async (): Promise<boolean> => {
  const lastJob = await prisma.merkleJob.findFirst({
    where: {
      status: "COMPLETED",
    },
    orderBy: {
      completedAt: "desc",
    },
  });

  // أول تشغيل
  if (!lastJob?.completedAt) {
    return true;
  }

  // 1️⃣ مستخدمين لديهم نقاط لكن بدون allocation
  const pendingAllocations =
    await prisma.user.count({
      where: {
        airdropPoints: { gt: 0 },
        airdropAllocatedWei: "0",
      },
    });

  if (pendingAllocations > 0) {
    return true;
  }

  // 2️⃣ مهام جديدة تم التحقق منها
  const newVerifiedTasks =
    await prisma.userTask.count({
      where: {
        status: "VERIFIED",
        rewardGiven: true,
        completedAt: {
          gt: lastJob.completedAt,
        },
      },
    });

  if (newVerifiedTasks > 0) {
    return true;
  }

  // 3️⃣ أي مستخدم تم تحديثه بعد آخر rebuild
  const changedUsers =
    await prisma.user.count({
      where: {
        updatedAt: {
          gt: lastJob.completedAt,
        },
      },
    });

  if (changedUsers > 0) {
    return true;
  }

  return false;
};

/**
 * Cron job handler
 * Can be called by node-cron or similar
 */
export const cronRebuild = async () => {
  console.log("[MerkleWorker] 🕐 Cron job started");

  const needed = await isRebuildNeeded();

  if (!needed) {
    console.log("[MerkleWorker] ⏭️ No rebuild needed");

    return {
      skipped: true,
    };
  }

  return await rebuildAndSync();
};