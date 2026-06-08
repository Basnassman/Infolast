import {
  UserStatus,
} from "@prisma/client";

import { prisma }
  from "@core/db/prisma";

import {
  updateParticipantAllocation,
} from "@modules/airdrop/services/participant.service";

import {
  AllocationResult,
} from "@modules/airdrop/domain/airdrop.types";

const DECIMALS = 18;

const TOKENS_PER_POINT = 10;

export const toWei =
  (
    tokens: string | number
  ): string => {
    const value =
      Number(tokens);

    return (BigInt(Math.floor(value)) * (10n ** BigInt(DECIMALS))).toString();

  };

export const fromWei =
  (
    wei: string
  ): string => {
    return (
      Number(wei) /
      10 ** DECIMALS
    ).toString();
  };

export const calculateAllocation =
  (
    points: number
  ): AllocationResult => {
    if (points <= 0) {
      return {
        eligible: false,

        allocationWei: "0",

        allocationTokens: "0",

        reason:
          "NO_POINTS",
      };
    }

    const tokens =
      Math.floor(
        points /
        TOKENS_PER_POINT
      );

    if (tokens <= 0) {
      return {
        eligible: false,

        allocationWei: "0",

        allocationTokens: "0",

        reason:
          "INSUFFICIENT_POINTS",
      };
    }

    return {
      eligible: true,

      allocationTokens:
        tokens.toString(),

      allocationWei:
        toWei(tokens),
    };
  };

export const recalculateAllocations =
  async () => {
    const participants =
      await prisma.airdropParticipant.findMany({
        where: {
          user: {
            status:
              UserStatus.ACTIVE,
          },
        },

        include: {
          user: true,
        },
      });

    let updated = 0;

    let totalAmountWei =
      0n;

    for (const participant of participants) {
      const allocation =
        calculateAllocation(
          participant.points
        );

      await updateParticipantAllocation(
        participant.id,
        allocation.allocationWei
      );

      totalAmountWei += BigInt(
        allocation.allocationWei
      );

      updated++;
    }

    return {
      updated,

      totalAmountWei:
        totalAmountWei.toString(),
    };
  };
