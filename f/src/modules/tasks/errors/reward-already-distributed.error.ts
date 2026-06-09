import { AppError } from "@core/errors/base/app-error";

export class RewardAlreadyDistributedError extends AppError {
  constructor(userTaskId: string) {
    super(
      "REWARD_ALREADY_DISTRIBUTED",
      `Reward already distributed for UserTask ${userTaskId}`,
      409
    );
  }
}