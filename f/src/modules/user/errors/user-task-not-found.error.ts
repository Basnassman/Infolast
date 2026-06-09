import { AppError } from "@core/errors/base/app-error";

export class UserTaskNotFoundError extends AppError {
  constructor(
    userId: string,
    taskId: string,
  ) {
    super(
      "USER_TASK_NOT_FOUND",
      `UserTask not found for user ${userId} and task ${taskId}`,
      
      404
    );
  }
}