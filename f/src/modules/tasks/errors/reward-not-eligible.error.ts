import { DomainError } from "@core/errors/base/domain-error";

export class RewardNotEligibleError extends DomainError {
  constructor(userId: string, taskId: string) {
    super(
      "REWARD_NOT_ELIGIBLE",
      `Verified reward record not found for user ${userId} and task ${taskId}`,
      404
    );
  }
}