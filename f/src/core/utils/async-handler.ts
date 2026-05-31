// src/core/utils/async-handler.ts

import {
  Request,
  Response,
  NextFunction,
  RequestHandler,
} from "express";

/**
 * Async Express Handler
 *
 * Removes repetitive try/catch
 * and forwards errors to:
 * global-error.middleware.ts
 */

export const asyncHandler = (
  fn: RequestHandler
): RequestHandler => {
  return (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    Promise.resolve(
      fn(req, res, next)
    ).catch(next);
  };
};
