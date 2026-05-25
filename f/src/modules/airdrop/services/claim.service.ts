import { prisma } from "../../../core/db/prisma";
import { airdropContractRead } from "../../../core/blockchain/airdrop.contract";
import { verifyProof } from "../merkle/tree.service";
import { getSyncStatus } from "./contract-sync.service";

/**
 * 🎯 Claim Service
 * Responsible ONLY for:
 * - Claim validation
 * - Recording claims
 * - Verifying proofs
 * 
 * NO Merkle building
 * NO Reward distribution
 * NO Point calculation
 */

export interface ClaimValidationResult {
  valid: boolean;
  reason?: string;
  amountWei?: string;
  proof?: string[];
}

/**
 * Validate a claim before processing
 * Checks: eligibility, proof
 */
 export const validateClaim = async (
  wallet: string
): Promise<ClaimValidationResult> => {

  const normalizedWallet =
    wallet.toLowerCase();

  // ================= USER =================
  const user =
    await prisma.user.findUnique({
      where: {
        wallet: normalizedWallet,
      },
      select: {
        airdropAllocatedWei: true,
        hasClaimedAirdrop: true,
        isBlocked: true,
      },
    });

  if (!user) {
    return {
      valid: false,
      reason: "User not found",
    };
  }

  if (user.isBlocked) {
    return {
      valid: false,
      reason: "User is blocked",
    };
  }

  if (user.hasClaimedAirdrop) {
    return {
      valid: false,
      reason: "Airdrop already claimed",
    };
  }

  if (
    !user.airdropAllocatedWei ||
    user.airdropAllocatedWei === "0"
  ) {
    return {
      valid: false,
      reason: "No allocation found",
    };
  }

  // ================= MERKLE =================
  const merkleData =
    await prisma.userMerkleProof.findUnique({
      where: {
        wallet: normalizedWallet,
      },
    });

  if (!merkleData) {
    return {
      valid: false,
      reason: "Merkle data not found",
    };
  }

  if (
    !merkleData.merkleProof ||
    merkleData.merkleProof.length === 0
  ) {
    return {
      valid: false,
      reason:
        "Merkle proof not generated yet",
    };
  }

  // ================= CONTRACT =================
  const syncStatus =
    await getSyncStatus();

  if (
    syncStatus.contractRoot ===
    "0x0000000000000000000000000000000000000000000000000000000000000000"
  ) {
    return {
      valid: false,
      reason: "Merkle root not set",
    };
  }

  // ================= VERIFY =================
  const isProofValid = verifyProof(
    syncStatus.contractRoot,
    merkleData.merkleLeaf,
    merkleData.merkleProof
  );

  if (!isProofValid) {
    return {
      valid: false,
      reason: "Invalid Merkle proof",
    };
  }

  // ================= ON-CHAIN =================
  const hasClaimed =
    await airdropContractRead.claimed(
      normalizedWallet
    );

  if (hasClaimed) {

    await prisma.user.update({
      where: {
        wallet: normalizedWallet,
      },
      data: {
        hasClaimedAirdrop: true,
      },
    });

    return {
      valid: false,
      reason: "Already claimed on-chain",
    };
  }

  return {
    valid: true,

    amountWei:
      user.airdropAllocatedWei,

    proof:
      merkleData.merkleProof,
  };
};
 
    
/**
 * Record a claim after successful on-chain transaction
 */
export const recordClaim = async (
  wallet: string,
  txHash: string,
  amountWei?: string
) => {
  const normalizedWallet = wallet.toLowerCase();

  return await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { wallet: normalizedWallet },
      select: {
        id: true,
        hasClaimedAirdrop: true,
        airdropAllocatedWei: true,
        airdropAllocated: true,
      },
    });

    if (!user) throw new Error("User not found");
    if (user.hasClaimedAirdrop) throw new Error("Airdrop already claimed");

    // Validate amount if provided
    if (amountWei && amountWei !== user.airdropAllocatedWei) {
      throw new Error("Claim amount mismatch");
    }

    // Create claim record
    await tx.airdropClaim.create({
      data: {
        userId: user.id,
        txHash,
        amountWei: user.airdropAllocatedWei,
        amountFor: user.airdropAllocated,
      },
    });

    // Update user state
    const updatedUser = await tx.user.update({
      where: { wallet: normalizedWallet },
      data: {
        hasClaimedAirdrop: true,
        airdropClaimedAt: new Date(),
        airdropTxHash: txHash,
      },
    });

    // Audit log
    await tx.auditLog.create({
      data: {
        action: "AIRDROP_CLAIM",
        userId: user.id,
        txHash,
        metadata: {
          amountWei: user.airdropAllocatedWei,
          amountFor: user.airdropAllocated.toString(),
        },
      },
    });

    return updatedUser;
  });
};

/**
 * Get claim status for a user
 */
export const getClaimStatus = async (wallet: string) => {
  const normalizedWallet = wallet.toLowerCase();

  const user = await prisma.user.findUnique({
    where: { wallet: normalizedWallet },
    select: {
      airdropAllocatedWei: true,
      hasClaimedAirdrop: true,
      airdropClaimedAt: true,
      airdropTxHash: true,
    },
  });

  const merkleData =
  await prisma.userMerkleProof.findUnique({
    where: {
      wallet: normalizedWallet,
    },
  });

  if (!user) {
    return {
      eligible: false,
      claimed: false,
      amountWei: "0",
      proof: [],
    };
  }

  return {
    eligible: user.airdropAllocatedWei !== "0",
    claimed: user.hasClaimedAirdrop,
    amountWei: user.airdropAllocatedWei,
    proof: merkleData?.merkleProof || [],
    claimedAt: user.airdropClaimedAt,
    txHash: user.airdropTxHash,
  };
};