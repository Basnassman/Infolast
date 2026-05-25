import { prisma } from "../../../core/db/prisma";

import {
  DistributionType,
  MerkleJobStatus,
  UserStatus,
} from "@prisma/client";

export const isRebuildNeeded =
  async (): Promise<boolean> => {
    const latestJob =
      await prisma.merkleJob.findFirst({
        where: {
          distributionType:
            DistributionType.AIRDROP,

          status:
            MerkleJobStatus.COMPLETED,
        },

        orderBy: {
          completedAt: "desc",
        },
      });

    // أول تشغيل
    if (
      !latestJob ||
      !latestJob.completedAt
    ) {
      return true;
    }

    // participants dirty
    const dirtyParticipants =
      await prisma.airdropParticipant.count({
        where: {
          airdropDirty: true,

          isEligible: true,

          user: {
            status:
              UserStatus.ACTIVE,
          },
        },
      });

    if (dirtyParticipants > 0) {
      return true;
    }

    // updated participants
    const updatedParticipants =
      await prisma.airdropParticipant.count({
        where: {
          updatedAt: {
            gt:
              latestJob.completedAt,
          },

          user: {
            status:
              UserStatus.ACTIVE,
          },
        },
      });

    if (
      updatedParticipants > 0
    ) {
      return true;
    }

    // new claims
    const newClaims =
      await prisma.distributionClaim.count({
        where: {
          distributionType:
            DistributionType.AIRDROP,

          createdAt: {
            gt:
              latestJob.completedAt,
          },
        },
      });

    if (newClaims > 0) {
      return true;
    }

    return false;
  };