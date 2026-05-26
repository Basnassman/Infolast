import {
  AllocationResult,
  EligibilityResult,
} from "@modules/airdrop/domain/airdrop.types";

export const evaluateEligibility = (
  allocation: AllocationResult
): EligibilityResult => {
  if (!allocation.eligible) {
    return {
      eligible: false,
      reason: allocation.reason,
    };
  }

  if (
    BigInt(allocation.allocationWei) <= 0n
  ) {
    return {
      eligible: false,
      reason: "Zero allocation",
    };
  }

  return {
    eligible: true,
  };
};