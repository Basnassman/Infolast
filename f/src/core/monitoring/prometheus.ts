import {
  Request,
  Response,
} from "express";

import { metricsRegistry } from "./metrics";

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