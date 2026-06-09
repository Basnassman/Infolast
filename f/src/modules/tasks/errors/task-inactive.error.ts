import { DomainError } from "@core/errors/base/domain-error";

export class TaskInactiveError extends DomainError {
  constructor(taskId: string) {
    super(
      "TASK_INACTIVE",
      `Task ${taskId} is inactive`,
      400
    );
  }
}