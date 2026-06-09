import { DomainError } from "@core/errors/base/domain-error";

export class TaskAlreadyCompletedError extends DomainError {
  constructor(taskId: string) {
    super(
      "TASK_ALREADY_COMPLETED",
      `Task ${taskId} has already been completed`,
      409
    );
  }
}