import { InfrastructureError } from "../../base/infrastructure-error";

export class CacheDeleteError extends InfrastructureError {
  constructor(
    key: string,
    details?: string
  ) {
    super(
      "CACHE_DELETE_ERROR",
      details
        ? `Failed to delete cache key '${key}': ${details}`
        : `Failed to delete cache key '${key}'`
    );
  }
}