import { InfrastructureError } from "../../base/infrastructure-error";

export class CacheReadError extends InfrastructureError {
  constructor(
    key: string,
    details?: string
  ) {
    super(
      "CACHE_READ_ERROR",
      details
        ? `Failed to read cache key '${key}': ${details}`
        : `Failed to read cache key '${key}'`
    );
  }
}