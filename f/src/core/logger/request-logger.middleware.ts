import {
  Request,
  Response,
  NextFunction,
} from "express";

import { logger } from "@core/logger/logger";

export const requestLogger =
  (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const startedAt =
      Date.now();

    res.on(
      "finish",
      () => {
        const durationMs =
          Date.now() -
          startedAt;

        logger.info({
          requestId:
            req.requestId,

          method:
            req.method,

          path:
            req.originalUrl,

          statusCode:
            res.statusCode,

          durationMs,

          ip: req.ip,
        });
      }
    );

    next();
  };