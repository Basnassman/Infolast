import { Prisma } from "@prisma/client";

import { AppError }
  from "@core/api/exceptions/app.error";

import { ConflictError }
  from "@core/api/exceptions/conflict.error";

import { NotFoundError }
  from "@core/api/exceptions/not-found.error";

export const mapPrismaError = (
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