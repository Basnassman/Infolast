import { InfrastructureError } from "@core/errors/base/infrastructure-error";

export class BlockchainTransactionFailedError extends InfrastructureError {
  constructor(txHash?: string) {
    super(
      "BLOCKCHAIN_TRANSACTION_FAILED",
      txHash
        ? `Blockchain transaction failed: ${txHash}`
        : "Blockchain transaction failed"
    );
  }
}