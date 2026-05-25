import { prisma } from "../../../core/db/prisma";
import { UserCategory } from "@prisma/client";
import { getClaimStatus } from "./claim.service";
import { getSyncStatus } from "./contract-sync.service";

/**
 * 🪂 Airdrop Service (Refactored)
 * 
 * Slimmed down to only:
 * - User category sync
 * - Eligibility queries
 * - High-level airdrop info
 * 
 * REMOVED:
 * - processAirdrop() (moved to allocation + merkle-sync)
 * - Merkle tree building
 * - Proof generation
 * - Direct contract interactions
 */

/**
 * Get airdrop eligibility for a user
 * Returns: amount (wei) + proof + alreadyClaimed
 */
export const getAirdropEligibility = async (wallet: string) => {
  const normalizedWallet = wallet.toLowerCase();

  // Use claim service for validation
  const claimStatus = await getClaimStatus(normalizedWallet);
  const syncStatus = await getSyncStatus();

  if (!claimStatus.eligible) {
    return {
      eligible: false,
      amount: "0",
      proof: [],
      alreadyClaimed: false,
      message: "Address not eligible for airdrop",
      rootSet: syncStatus.dbRoot !== "0x0",
    };
  }

  return {
    eligible: true,
    amount: claimStatus.amountWei,
    proof: claimStatus.proof,
    alreadyClaimed: claimStatus.claimed,
    rootSet: syncStatus.dbRoot !== "0x0",
    root: syncStatus.dbRoot,
  };
};

/**
 * Sync user category based on activity
 * Called after purchases or point changes
 */
export const syncUserCategory = async (wallet: string) => {
  const user = await prisma.user.findUnique({
    where: { wallet: wallet.toLowerCase() },
    include: { _count: { select: { purchases: true } } },
  });

  if (!user) return;

  let category: UserCategory = UserCategory.NONE;
  const hasAirdrop = user.airdropPoints > 0;
  const hasPurchases = user._count.purchases > 0;

  if (hasAirdrop && hasPurchases) category = UserCategory.AIRDROP_BUYER;
  else if (hasAirdrop) category = UserCategory.AIRDROP_ONLY;
  else if (hasPurchases) category = UserCategory.BUYER_ONLY;

  await prisma.user.update({
    where: { wallet: user.wallet },
    data: { category },
  });
};

/**
 * Get airdrop statistics
 */
export const getAirdropStats = async () => {
  const [
    totalUsers,
    eligibleUsers,
    claimedUsers,
    totalPoints,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({
      where: { airdropAllocatedWei: { not: "0" } },
    }),
    prisma.user.count({
      where: { hasClaimedAirdrop: true },
    }),
    prisma.user.aggregate({
      _sum: { airdropPoints: true },
    }),
  ]);

  const syncStatus = await getSyncStatus();

  return {
    totalUsers,
    eligibleUsers,
    claimedUsers,
    totalPoints: totalPoints._sum.airdropPoints || 0,
    merkleRoot: syncStatus.dbRoot,
    contractRoot: syncStatus.contractRoot,
    inSync: syncStatus.inSync,
    lastSyncedAt: syncStatus.lastSyncedAt,
  };
};