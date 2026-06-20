import { InfrastructureError } from "@core/errors/base/infrastructure-error";

export class PurchaseSyncError extends InfrastructureError {
  constructor(reason?: string) {
    super(
      "PURCHASE_SYNC_FAILED",
      reason
        ? `Purchase sync failed: ${reason}`
        : "Purchase sync failed"
    );
  }
}
