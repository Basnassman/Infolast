import { AppError } from "@core/errors/base/app-error";

export class TaskNotFoundError extends AppError {
  constructor(taskId: string) {
    super(
      "TASK_NOT_FOUND",
      `Task ${taskId} not found`,
      404
    );
  }
}