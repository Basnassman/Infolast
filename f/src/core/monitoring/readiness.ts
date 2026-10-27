import {
  Request,
  Response,
} from "express";

import { healthCheck } from "@core/monitoring/health-check";

export const readinessHandler =
  async (
    _: Request,
    res: Response
  ) => {
    const result =
      await healthCheck();

    // Only "unhealthy" (database/redis) makes the instance unready.
    // "degraded" (RPC unreachable / wrong chain) is reported but does not
    // trigger a restart loop.
    if (
      result.status ===
      "unhealthy"
    ) {
      return res.status(503).json(
        result
      );
    }

    return res.json(result);
  };
