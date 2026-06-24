import { createClaim } from "@modules/airdrop/repositories/claim.repository";
import { validateClaim } from "@modules/airdrop/services/claim-validation.service";
import { syncClaimTransaction } from "@modules/airdrop/services/claim-sync.service";
import { prisma } from "@core/db/prisma";
import { ClaimStatusResult } from "@modules/airdrop/types/airdrop.types";
import { ClaimNotEligibleError } from "@modules/airdrop/errors/claim-not-eligible.error";
import { UserNotFoundError } from "@modules/user/errors/user-not-found.error";
import { AirdropParticipantNotFoundError } from "@modules/airdrop/errors/airdrop-participant-not-found.error"
import { verificationEligibilityService } from "@modules/verification/services/eligibility.service"

export const getClaimStatus = async (walletAddress: string): Promise<ClaimStatusResult> => {
  const normalized = walletAddress.toLowerCase();
  const validation = await validateClaim(normalized);

  const user = await prisma.user.findUnique({
    where: { walletAddress: normalized },
    select: { id: true },
  });

  if (!user) {
    return {
      eligible: false,
      amountWei: "0",
      points: 0,
      proof: [],
      claims: [],
    };
  }

  const claims = await prisma.distributionClaim.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  const participant = await prisma.airdropParticipant.findUnique({
    where: { userId: user.id },
    select: { points: true },
  });

  return {
    eligible: validation.valid,
    amountWei: validation.amountWei || "0",
    points: participant?.points || 0,
    proof: validation.proof || [],
    claims,
  };
};

export const recordClaim = async (walletAddress: string, txHash: string) => {
  const validation = await validateClaim(walletAddress);

  if (!validation.valid) {
    throw new ClaimNotEligibleError(
  validation.reason || "Claim validation failed"
  );
  }

  const user = await prisma.user.findUnique({
    where: { walletAddress: walletAddress.toLowerCase() },
  });

  if (!user) {
    throw new UserNotFoundError(walletAddress);
  }

  // ─── Verification Eligibility Check ──────────────────────────
  const eligibility = await verificationEligibilityService.verifyBeforeClaim(user.id);
  if (!eligibility.eligible) {
    const failedPlatforms = eligibility.failedTasks.map(t => t.platform).join(", ");
    throw new ClaimNotEligibleError(
      `Verification failed for platforms: ${failedPlatforms}. Please re-verify your accounts.`
    );
  }

  const airdropParticipant = await prisma.airdropParticipant.findUnique({
    where: { userId: user.id },
  });

  if (!airdropParticipant) {
  throw new AirdropParticipantNotFoundError(
    user.id
  );
  }

  const claim = await createClaim({
    userId: user.id,
    airdropParticipantId: airdropParticipant.id,
    txHash,
    amountWei: validation.amountWei!,
  });

  await syncClaimTransaction(claim.id, txHash);

  return claim;
};
