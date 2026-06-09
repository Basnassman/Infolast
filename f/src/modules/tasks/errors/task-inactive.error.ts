import { AppError } from "@core/errors/base/app-error";

export class TaskInactiveError extends AppError {
  constructor(taskId: string) {
    super(
      "TASK_INACTIVE",
      `Task ${taskId} is inactive`,
      400
    );
  }
}