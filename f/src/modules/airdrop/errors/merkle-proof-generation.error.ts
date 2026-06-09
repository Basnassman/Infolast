import { DomainError } from "@core/errors/base/domain-error";

export class MerkleProofGenerationError extends DomainError {
  constructor(walletAddress: string) {
    super(
      "MERKLE_PROOF_GENERATION_FAILED",
      `Missing proof for wallet ${walletAddress}`,
      500
    );
  }
}