import { DomainError } from "@core/errors/base/domain-error";

export class TaskSubmissionLimitReachedError extends DomainError {
  constructor(taskId: string) {
    super(
      "TASK_SUBMISSION_LIMIT_REACHED",
      `Task ${taskId} submission limit reached`,
      409
    );
  }
}