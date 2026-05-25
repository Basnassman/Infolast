import { prisma } from "../../../core/db/prisma";
import { calculateUserAllocation } from "../../airdrop//services/allocation.service";

/**
 * 💰 Reward Engine (Refactored)
 * 
 * Responsible ONLY for:
 * - Adding points to user
 * - Updating airdropPoints
 * - Marking rewardGiven
 * - Triggering allocation calculation
 * 
 * REMOVED:
 * - processAirdrop() calls
 * - Merkle logic
 * - Proof generation
 * - Blockchain calls
 * 
 * Architecture:
 * Task Worker → Reward Service → DB Points
 *                          ↓
 *                    Merkle Worker (separate batch)
 */

export interface RewardResult {
  success: boolean;
  points: number;
  newTotalPoints: number;
  allocation?: {
    tokens: string;
    tokensWei: string;
  };
}

/**
 * Distribute reward for a completed task
 * Pure DB operation - no blockchain, no Merkle
 */
export const distributeReward = async (
  userId: string,
  taskId: string
): Promise<RewardResult> => {
  return await prisma.$transaction(async (tx) => {
    // 1. Double-check task status
    const userTask = await tx.userTask.findUnique({
      where: { userId_taskId: { userId, taskId } },
      include: { task: true, user: true },
    });

    if (!userTask || userTask.status !== "VERIFIED") {
      throw new Error("Task not verified");
    }

    if (userTask.rewardGiven) {
      throw new Error("Reward already given");
    }

    // 2. Mark reward as given FIRST (prevent race conditions)
    await tx.userTask.update({
      where: { id: userTask.id },
      data: { rewardGiven: true },
    });

    // 3. Calculate new points
    const newPoints = userTask.user.airdropPoints + userTask.task.points;

    // 4. Update user points
    await tx.user.update({
      where: { id: userId },
      data: { airdropPoints: newPoints },
    });

    // 5. Calculate allocation (off-chain only)
    const allocation = calculateUserAllocation(
      userTask.user.wallet,
      newPoints
    );

    // 6. If eligible, update allocation (still no Merkle here)
    if (allocation.eligible) {
      await tx.user.update({
        where: { id: userId },
        data: {
          airdropAllocated: String(allocation.tokens),
          airdropAllocatedWei: allocation.tokensWei,
        },
      });
    }

    return {
      success: true,
      points: userTask.task.points,
      newTotalPoints: newPoints,
      allocation: allocation.eligible
        ? {
            tokens: String(allocation.tokens), // Ensure string
            tokensWei: allocation.tokensWei,
          }
        : undefined,
    };
  });
};

/**
 * Check if reward was already given
 * Used by task worker to prevent double processing
 */
export const isRewardGiven = async (
  userId: string,
  taskId: string
): Promise<boolean> => {
  const userTask = await prisma.userTask.findUnique({
    where: { userId_taskId: { userId, taskId } },
    select: { rewardGiven: true },
  });

  return userTask?.rewardGiven ?? false;
};

/**
 * Get user's current points and allocation
 */
export const getUserRewardState = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      airdropPoints: true,
      airdropAllocated: true,
      airdropAllocatedWei: true,
    },
  });

  return user || { airdropPoints: 0, airdropAllocated: 0, airdropAllocatedWei: "0" };
};