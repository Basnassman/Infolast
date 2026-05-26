import {
  DistributionType,
} from "@prisma/client";

import { prisma } from "@core/db/prisma";

import { participantRepository } from "@modules/airdrop/repositories/participant.repository";

export const createAirdropSnapshot =
  async () => {
    const participants =
      await participantRepository.findEligibleParticipants();

    const totalAmountWei =
      participants.reduce(
        (sum, participant) =>
          sum +
          BigInt(
            participant.allocationWei
          ),
        0n
      );

    const latest =
      await prisma.distributionSnapshot.findFirst({
        where: {
          distributionType:
            DistributionType.AIRDROP,
        },
        orderBy: {
          snapshotVersion: "desc",
        },
      });

    const snapshotVersion =
      (latest?.snapshotVersion || 0) + 1;

    return prisma.distributionSnapshot.create({
      data: {
        distributionType:
          DistributionType.AIRDROP,

        snapshotVersion,

        totalUsers:
          participants.length,

        totalAmountWei:
          totalAmountWei.toString(),

        metadata: {
          participantIds:
            participants.map(
              (p) => p.id
            ),
        },
      },
    });
  };