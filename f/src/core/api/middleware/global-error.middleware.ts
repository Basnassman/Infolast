import {
  Request,
  Response,
  NextFunction,
} from "express";

import {
  errorResponse,
} from "@core/api/responses/error.response";

import {
  normalizeError,
} from "@core/errors/mappers/error-mapper";

const isProduction =
  process.env.NODE_ENV === "production";

export const globalErrorMiddleware = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  const normalizedError =
    normalizeError(error);

  if (!isProduction) {
    console.error(
      "[GlobalErrorMiddleware]",
      {
        name:
          normalizedError.name,

        code:
          normalizedError.code,

        message:
          normalizedError.message,

        statusCode:
          normalizedError.statusCode,

        stack:
          normalizedError.stack,
      }
    );
  }

  return errorResponse(
    res,
    normalizedError.code,
    normalizedError.message,
    normalizedError.statusCode,
    !isProduction
      ? normalizedError.stack
      : undefined
  );
};