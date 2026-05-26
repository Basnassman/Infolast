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

    if (
      result.status !==
      "healthy"
    ) {
      return res.status(503).json(
        result
      );
    }

    return res.json(result);
  };