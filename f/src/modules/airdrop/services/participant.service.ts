import {
  calculateAllocation,
} from "../engine/allocation.engine";

import {
  evaluateEligibility,
} from "../engine/eligibility.engine";

import { prisma } from "../../../core/db/prisma";

import { participantRepository } from "../repositories/participant.repository";

import { getTotalPurchasedUsd } from "./allocation.service";

export const syncParticipantAllocation =
  async (userId: string) => {
    const participant =
      await participantRepository.getOrCreate(
        userId
      );

    const totalPurchasedUsd =
      await getTotalPurchasedUsd(userId);

    const allocation =
      calculateAllocation({
        walletAddress:
          participant.user.walletAddress,
        points: participant.points,
        totalPurchasedUsd,
      });

    const eligibility =
      evaluateEligibility(allocation);

    return participantRepository.updateAllocation(
      participant.id,
      {
        points: allocation.points,
        allocationWei:
          allocation.allocationWei,
        isEligible:
          eligibility.eligible,
      }
    );
  };

export const addParticipantPoints =
  async (
    userId: string,
    points: number
  ) => {
    const participant =
      await participantRepository.getOrCreate(
        userId
      );

    await prisma.airdropParticipant.update({
      where: {
        id: participant.id,
      },
      data: {
        points: {
          increment: points,
        },
      },
    });

    return syncParticipantAllocation(
      userId
    );
  };