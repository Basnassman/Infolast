import { AppError } from "@core/errors/base/app-error";

export class UserTaskNotFoundError extends AppError {
  constructor(userTaskIdOrUserId: string, taskId?: string) {
    if (taskId) {
      super(
        "USER_TASK_NOT_FOUND",
        `UserTask not found for user ${userTaskIdOrUserId} and task ${taskId}`,
        404
      );
    } else {
      super(
        "USER_TASK_NOT_FOUND",
        `UserTask ${userTaskIdOrUserId} not found`,
        404
      );
    }
  }
}