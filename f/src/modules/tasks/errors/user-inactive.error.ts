import { DomainError } from "@core/errors/base/domain-error";

export class UserInactiveError extends DomainError {
  constructor(userId: string) {
    super(
      "USER_INACTIVE",
      `User ${userId} is not active`,
      403
    );
  }
}