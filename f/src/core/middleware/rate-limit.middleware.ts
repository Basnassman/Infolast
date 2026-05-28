import {
  Request,
  Response,
  NextFunction,
} from "express";

import {
  ApiError,
} from "../../core/contracts-api/error.contract";

import { env } from "../../core/config/env";

export interface RateLimitOptions {
  windowMs: number;

  maxRequests: number;
}

type RequestRecord = {
  count: number;

  resetAt: number;
};

const requestStore =
  new Map<
    string,
    RequestRecord
  >();

export const rateLimit =
  (
    options: RateLimitOptions
  ) => {
    return (
      req: Request,
      res: Response,
      next: NextFunction
    ) => {
      const key =
        req.ip ||
        "unknown";

      const now =
        Date.now();

      const existing =
        requestStore.get(
          key
        );

      if (
        !existing ||
        existing.resetAt <
          now
      ) {
        requestStore.set(
          key,
          {
            count: 1,

            resetAt:
              now +
              options.windowMs,
          }
        );

        return next();
      }

      if (
        existing.count >=
        options.maxRequests
      ) {
        const retryAfter =
          Math.ceil(
            (
              existing.resetAt -
              now
            ) / 1000
          );

        const response: ApiError =
          {
            success: false,

            error: {
              code:
                "RATE_LIMITED",

              message:
                "Too many requests",
            },
          };

        res.setHeader(
          "Retry-After",
          retryAfter
        );

        return res
          .status(429)
          .json(
            response
          );
      }

      existing.count += 1;

      next();
    };
  };

export const walletRateLimit =
  rateLimit({
    windowMs:
      env.rateLimit.windowMs,

    maxRequests:
      env.rateLimit.maxRequests,
  });