import { AppError } from "@core/errors/base/app-error";

export class TaskAlreadyApprovedError extends AppError {
  constructor(userTaskId: string) {
    super(
      "TASK_ALREADY_APPROVED",
      `Task ${userTaskId} is already approved`,
      409
    );
  }
}
