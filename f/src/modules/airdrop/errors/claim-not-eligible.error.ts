import { DomainError } from "@core/errors/base/domain-error";

export class ClaimNotEligibleError extends DomainError {
  constructor(reason: string) {
    super(
      "CLAIM_NOT_ELIGIBLE",
      reason,
      400
    );
  }
}