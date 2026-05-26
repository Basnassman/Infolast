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

export const asyncHandler =
  <
    P = any,
    ResBody = any,
    ReqBody = any,
    ReqQuery = any
  >(
    fn: (
      req: Request<
        P,
        ResBody,
        ReqBody,
        ReqQuery
      >,
      res: Response<ResBody>,
      next: NextFunction
    ) => Promise<any>
  ): RequestHandler<
    P,
    ResBody,
    ReqBody,
    ReqQuery
  > => {
    return (
      req,
      res,
      next
    ) => {
      Promise.resolve(
        fn(req, res, next)
      ).catch(next);
    };
  };