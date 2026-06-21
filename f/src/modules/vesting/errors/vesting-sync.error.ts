import { InfrastructureError } from "@core/errors/base/infrastructure-error";

export class VestingSyncError extends InfrastructureError {
  constructor(reason?: string) {
    super(
      "VESTING_SYNC_FAILED",
      reason
        ? `Vesting sync failed: ${reason}`
        : "Vesting sync failed"
    );
  }
}
