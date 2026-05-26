import {
  prisma,
} from "@core/db/prisma";

import {
  DistributionType,
  MerkleRootStatus,
} from "@prisma/client";

import {
  getClaimStatus,
} from "@modules/airdrop/services/claim.service";

export const getAirdropEligibility =
  async (
    walletAddress: string
  ) => {
    const normalized =
      walletAddress.toLowerCase();

    const status =
      await getClaimStatus(
        normalized
      );

    return {
      eligible:
        status.eligible,

      amountWei:
        status.amountWei,

      proof:
        status.proof,

      claims:
        status.claims,
    };
  };

export const getAirdropStats =
  async () => {
    const [
      users,
      participants,
      claims,
      activeRoot,
    ] = await Promise.all([
      prisma.user.count(),

      prisma.airdropParticipant.count(),

      prisma.distributionClaim.count({
        where: {
          distributionType:
            DistributionType.AIRDROP,
        },
      }),

      prisma.merkleRoot.findFirst({
        where: {
          distributionType:
            DistributionType.AIRDROP,

          status:
            MerkleRootStatus.ACTIVE,
        },

        orderBy: {
          createdAt: "desc",
        },
      }),
    ]);

    return {
      totalUsers:
        users,

      participants,

      claims,

      activeRoot:
        activeRoot?.root ||
        null,

      eligibleCount:
        activeRoot?.eligibleCount ||
        0,

      totalAmountWei:
        activeRoot?.totalAmountWei ||
        "0",
    };
  };
