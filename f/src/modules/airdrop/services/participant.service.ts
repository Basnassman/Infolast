import {
  UserStatus,
} from "@prisma/client";

import * as participantRepository
  from "../repositories/participant.repository";

export const getEligibleParticipants =
  async () => {
    const participants =
      await participantRepository.getEligibleParticipants();

    return participants.filter(
      (participant) =>
        participant.user.status ===
          UserStatus.ACTIVE &&
        participant.isEligible &&
        participant.points > 0
    );
  };

export const getDirtyParticipants =
  async () => {
    return participantRepository.getDirtyParticipants();
  };

export const markParticipantDirty =
  async (
    participantId: string
  ) => {
    return participantRepository.markDirty(
      participantId
    );
  };

export const clearParticipantDirty =
  async (
    participantId: string
  ) => {
    return participantRepository.clearDirty(
      participantId
    );
  };

export const updateParticipantAllocation =
  async (
    participantId: string,
    allocationWei: string
  ) => {
    return participantRepository.updateAllocation(
      participantId,
      allocationWei
    );
  };
