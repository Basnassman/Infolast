import { AppError } from "@core/errors/base/app-error";

export class UserNotFoundError extends AppError {
  constructor(userId: string) {
    super(
      "USER_NOT_FOUND",
      `User ${userId} not found`,
      404
    );
  }
}