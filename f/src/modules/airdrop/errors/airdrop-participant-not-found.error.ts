import { DomainError } from "@core/errors/base/domain-error";

export class AirdropParticipantNotFoundError extends DomainError {
  constructor(userId: string) {
    super(
      "AIRDROP_PARTICIPANT_NOT_FOUND",
      `Airdrop participant not found for user ${userId}`,
      404
    );
  }
}