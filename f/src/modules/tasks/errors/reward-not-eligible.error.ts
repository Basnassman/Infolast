import { AppError } from "@core/errors/base/app-error";

export class RewardNotEligibleError extends AppError {
  constructor(userId: string, taskId: string) {
    super(
      "REWARD_NOT_ELIGIBLE",
      `Verified reward record not found for user ${userId} and task ${taskId}`,
      404
    );
  }
}