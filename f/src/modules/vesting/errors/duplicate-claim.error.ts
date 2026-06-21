import { AppError } from "@core/errors/base/app-error";

export class DuplicateClaimError extends AppError {
  constructor(txHash: string) {
    super(
      "DUPLICATE_CLAIM",
      `Claim with txHash ${txHash} already recorded`,
      409
    );
  }
}
