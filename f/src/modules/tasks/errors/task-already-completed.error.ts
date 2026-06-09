import { AppError } from "@core/errors/base/app-error";

export class TaskAlreadyCompletedError extends AppError {
  constructor(taskId: string) {
    super(
      "TASK_ALREADY_COMPLETED",
      `Task ${taskId} has already been completed`,
      409
    );
  }
}