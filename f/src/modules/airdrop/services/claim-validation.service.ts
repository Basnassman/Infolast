import { UserStatus, ClaimStatus } from "@prisma/client";
import { prisma } from "@core/db/prisma";
import { getActiveMerkleRoot } from "@modules/airdrop/repositories/merkle-root.repository";
import { getWalletProof } from "@modules/airdrop/repositories/merkle-proof.repository";
import { verifyProof } from "@modules/airdrop/merkle/tree.service";
import { ClaimValidationReason } from "@modules/airdrop/domain/claim-validation-reason"

export interface ClaimValidationResult {
  valid: boolean;
  reason?: string;
  amountWei?: string;
  proof?: string[];
  merkleRoot?: string;
  merkleRootId?: string;
}

export const validateClaim = async (
  walletAddress: string
): Promise<ClaimValidationResult> => {
  const normalized = walletAddress.toLowerCase();

  // 1️⃣ user
  const user = await prisma.user.findUnique({
    where: { walletAddress: normalized },
    select: { id: true, status: true },
  });

  if (!user) {
    return { valid: false, reason: ClaimValidationReason.USER_NOT_FOUND };
  }

  if (user.status !== UserStatus.ACTIVE) {
    return { valid: false, reason: ClaimValidationReason.USER_NOT_ACTIVE };
  }

  // 2️⃣ active root
  const activeRoot = await getActiveMerkleRoot();

  if (!activeRoot) {
    return { valid: false, reason: ClaimValidationReason.NO_ACTIVE_MERKLE_ROOT };
  }

  // 3️⃣ proof
  const proof = await getWalletProof(normalized); // ✅ إصلاح: استدعاء مباشر

  if (!proof) {
    return { valid: false, reason: ClaimValidationReason.PROOF_NOT_FOUND };
  }

  if (BigInt(proof.amountWei) <= 0n) {
    return { valid: false, reason: ClaimValidationReason.INVALID_ALLOCATION };
  }

  if (
    !Array.isArray(proof.proof) ||
    !proof.proof.every((item) => typeof item === "string")
  ) {
    return { valid: false, reason: ClaimValidationReason.INVALID_PROOF_DATA };
  }

  // ✅ إصلاح: التحقق من المطالبة عبر airdropParticipantId وليس merkleRootId
  const airdropParticipant = await prisma.airdropParticipant.findUnique({
    where: { userId: user.id },
  });

  // 4️⃣ already claimed
  const existingClaim = await prisma.distributionClaim.findFirst({
    where: {
      userId: user.id,
      airdropParticipantId: airdropParticipant?.id,
      status: {
        in: [ClaimStatus.PENDING, ClaimStatus.CLAIMED],
      },
    },
  });

  if (existingClaim) {
    return { valid: false, reason: ClaimValidationReason.ALREADY_CLAIMED };
  }

  // 5️⃣ verify proof
  const verified = verifyProof(activeRoot.root, proof.leaf, proof.proof as string[]);

  if (!verified) {
    return { valid: false, reason: ClaimValidationReason.INVALID_MERKLE_PROOF };
  }

  return {
    valid: true,
    amountWei: proof.amountWei,
    proof: proof.proof as string[],
    merkleRoot: activeRoot.root,
    merkleRootId: activeRoot.id,
  };
};
