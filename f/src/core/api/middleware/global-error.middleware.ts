// src/core/middleware/global-error.middleware.ts

import {
  Request,
  Response,
  NextFunction,
} from "express";

import { ZodError } from "zod";

import {
  Prisma,
} from "@prisma/client";

import {
  AppError,
} from "../../api/exceptions/app.error";

import {
  ValidationError,
} from "../../api/exceptions/validation.error";

import {
  ConflictError,
} from "../../api/exceptions/conflict.error";

import {
  NotFoundError,
} from "../../api/exceptions/not-found.error";

import {
  UnauthorizedError,
} from "../../api/exceptions/unauthorized.error";

import {
  ForbiddenError,
} from "../../api/exceptions/forbidden.error";

import {
  BlockchainError,
} from "../../api/exceptions/blockchain.error";

import {
  errorResponse,
} from "../../api/responses/error.response";

const isProduction =
  process.env.NODE_ENV === "production";

/**
 * Prisma → AppError mapper
 */
const mapPrismaError = (
  error: Prisma.PrismaClientKnownRequestError
): AppError => {
  switch (error.code) {
    case "P2002":
      return new ConflictError(
        "Resource already exists"
      );

    case "P2025":
      return new NotFoundError(
        "Resource not found"
      );

    default:
      return new AppError(
        "DATABASE_ERROR",
        "Database operation failed",
        500
      );
  }
};

/**
 * Zod → ValidationError mapper
 */
const mapZodError = (
  error: ZodError
): ValidationError => {
  const message = error.issues
    .map((e: any) => `${e.path.join(".")}: ${e.message}`)
    .join(", ");

  return new ValidationError(message || "Validation failed");
};

/**
 * Unknown → AppError mapper
 */
const normalizeUnknownError = (
  error: any
): AppError => {
  // Already AppError
  if (error instanceof AppError) {
    return error;
  }

  // Zod
  if (error instanceof ZodError) {
    return mapZodError(error);
  }

  // Prisma
  if (
    error instanceof
    Prisma.PrismaClientKnownRequestError
  ) {
    return mapPrismaError(error);
  }

  // Ethers / blockchain
  if (
    typeof error?.message === "string" &&
    (
      error.message.includes("execution reverted") ||
      error.message.includes("CALL_EXCEPTION") ||
      error.message.includes("insufficient funds")
    )
  ) {
    return new BlockchainError(
      error.message
    );
  }

  // Unauthorized
  if (
    error?.name === "UnauthorizedError"
  ) {
    return new UnauthorizedError(
      error.message
    );
  }

  // Generic fallback
  return new AppError(
    "INTERNAL_SERVER_ERROR",
    isProduction
      ? "Internal server error"
      : error?.message ||
          "Unknown error",
    500
  );
};

/**
 * Global Error Middleware
 */
export const globalErrorMiddleware = (
  error: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  const normalizedError =
    normalizeUnknownError(error);

  // Development logging
  if (!isProduction) {
    console.error(
      "\n[GlobalErrorMiddleware]",
      {
        name:
          normalizedError.name,

        code:
          normalizedError.code,

        message:
          normalizedError.message,

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
    !isProduction ? normalizedError.stack : undefined
  );
};