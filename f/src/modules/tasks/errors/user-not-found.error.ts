import { DomainError } from "@core/errors/base/domain-error";

export class UserNotFoundError extends DomainError {
  constructor(userId: string) {
    super(
      "USER_NOT_FOUND",
      `User ${userId} not found`,
      404
    );
  }
}