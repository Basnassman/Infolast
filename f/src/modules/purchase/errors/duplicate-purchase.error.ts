import { DomainError } from "@core/errors/base/domain-error";

export class DuplicatePurchaseError extends DomainError {
  constructor(txHash: string) {
    super(
      "DUPLICATE_PURCHASE",
      `Purchase with txHash ${txHash} already exists`,
      409
    );
  }
}
