import { DomainError } from "@core/errors/base/domain-error";

export class TaskNotUnderReviewError extends DomainError {
  constructor(userTaskId: string) {
    super(
      "TASK_NOT_UNDER_REVIEW",
      `UserTask ${userTaskId} is not under review`,
      409
    );
  }
}