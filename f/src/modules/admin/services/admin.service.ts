import { prisma } from "@core/db/prisma";
import { DistributionType } from "@prisma/client";

export const getMerkleJobs = async () => {
  return prisma.merkleJob.findMany({
    where: {
      distributionType: DistributionType.AIRDROP,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 50,
  });
};
