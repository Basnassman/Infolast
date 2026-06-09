import { DomainError } from "@core/errors/base/domain-error";

export class UserTaskNotFoundError extends DomainError {
  constructor(userTaskId: string) {
    super(
      "USER_TASK_NOT_FOUND",
      `UserTask ${userTaskId} not found`,
      404
    );
  }
}