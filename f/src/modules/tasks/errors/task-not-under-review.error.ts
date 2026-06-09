import { AppError } from "@core/errors/base/app-error";

export class TaskNotUnderReviewError extends AppError {
  constructor(userTaskId: string) {
    super(
      "TASK_NOT_UNDER_REVIEW",
      `UserTask ${userTaskId} is not under review`,
      409
    );
  }
}