import { AppError } from "@core/errors/base/app-error";

export class TaskSubmissionLimitReachedError extends AppError {
  constructor(taskId: string) {
    super(
      "TASK_SUBMISSION_LIMIT_REACHED",
      `Task ${taskId} submission limit reached`,
      409
    );
  }
}