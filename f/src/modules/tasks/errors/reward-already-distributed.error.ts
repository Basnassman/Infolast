import { DomainError } from "@core/errors/base/domain-error";

export class RewardAlreadyDistributedError extends DomainError {
  constructor(userTaskId: string) {
    super(
      "REWARD_ALREADY_DISTRIBUTED",
      `Reward already distributed for UserTask ${userTaskId}`,
      409
    );
  }
}