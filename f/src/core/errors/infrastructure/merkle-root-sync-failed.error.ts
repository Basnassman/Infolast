import { InfrastructureError } from "@core/errors/base/infrastructure-error";

export class MerkleRootSyncFailedError extends InfrastructureError {
  constructor(reason?: string) {
    super(
      "MERKLE_ROOT_SYNC_FAILED",
      reason
        ? `Failed to sync merkle root: ${reason}`
        : "Failed to sync merkle root"
    );
  }
}