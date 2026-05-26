import {
  Request,
  Response,
  NextFunction,
} from "express";

import crypto from "crypto";

export const requestIdMiddleware =
  (
    req: Request,
    _: Response,
    next: NextFunction
  ) => {
    req.requestId =
      crypto.randomUUID();

    next();
  };