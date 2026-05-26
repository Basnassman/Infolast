import {
  Request,
  Response,
} from "express";

import { metricsRegistry } from "@core/monitoring/metrics";

export const prometheusHandler =
  async (
    _: Request,
    res: Response
  ) => {
    res.set(
      "Content-Type",
      metricsRegistry.contentType
    );

    res.end(
      await metricsRegistry.metrics()
    );
  };