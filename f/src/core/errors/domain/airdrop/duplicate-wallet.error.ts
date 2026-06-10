import { DomainError } from "@core/errors/base/domain-error";

export class DuplicateWalletError extends DomainError {
  constructor(
    walletAddress: string
  ) {
    super(
      "DUPLICATE_WALLET",
      `Duplicate wallet detected: ${walletAddress}`,
      400
    );
  }
}