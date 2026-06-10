import { InfrastructureError } from "../../base/infrastructure-error";

export class CacheWriteError extends InfrastructureError {
  constructor(
    key: string,
    details?: string
  ) {
    super(
      "CACHE_WRITE_ERROR",
      details
        ? `Failed to write cache key '${key}': ${details}`
        : `Failed to write cache key '${key}'`
    );
  }
}