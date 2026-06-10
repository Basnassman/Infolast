import { InfrastructureError } from "../../base/infrastructure-error";

export class CacheParseError extends InfrastructureError {
  constructor(
    key: string,
    details?: string
  ) {
    super(
      "CACHE_PARSE_ERROR",
      details
        ? `Failed to parse cache key '${key}': ${details}`
        : `Failed to parse cache key '${key}'`
    );
  }
}