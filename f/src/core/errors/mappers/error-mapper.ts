import { Prisma }
  from "@prisma/client";

import { ZodError }
  from "zod";

import { AppError }
  from "@core/api/exceptions/app.error";

import { UnauthorizedError }
  from "@core/api/exceptions/unauthorized.error";

import { mapPrismaError }
  from "./prisma-error.mapper";

import { mapZodError }
  from "./zod-error.mapper";

import { mapBlockchainError }
  from "./blockchain-error.mapper";

const isProduction =
  process.env.NODE_ENV === "production";

export const normalizeError = (
  error: any
): AppError => {
  if (
    error instanceof AppError
  ) {
    return error;
  }

  if (
    error instanceof ZodError
  ) {
    return mapZodError(error);
  }

  if (
    error instanceof
    Prisma.PrismaClientKnownRequestError
  ) {
    return mapPrismaError(error);
  }

  const blockchainError =
    mapBlockchainError(error);

  if (blockchainError) {
    return blockchainError;
  }

  if (
    error?.name ===
    "UnauthorizedError"
  ) {
    return new UnauthorizedError(
      error.message
    );
  }

  return new AppError(
    "INTERNAL_SERVER_ERROR",
    isProduction
      ? "Internal server error"
      : error?.message ||
          "Unknown error",
    500
  );
};