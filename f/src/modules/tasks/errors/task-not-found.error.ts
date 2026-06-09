import { DomainError } from "@core/errors/base/domain-error";

export class TaskNotFoundError extends DomainError {
  constructor(taskId: string) {
    super(
      "TASK_NOT_FOUND",
      `Task ${taskId} not found`,
      404
    );
  }
}