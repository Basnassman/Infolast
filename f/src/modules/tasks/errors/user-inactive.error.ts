import { AppError } from "@core/errors/base/app-error";

export class UserInactiveError extends AppError {
  constructor(userId: string) {
    super(
      "USER_INACTIVE",
      `User ${userId} is not active`,
      403
    );
  }
}