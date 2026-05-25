import { prisma } from "../../../core/db/prisma";

export const getTotalPurchasedUsd =
  async (
    userId: string
  ): Promise<number> => {
    const purchases =
      await prisma.purchase.findMany({
        where: {
          userId,
        },
        select: {
          paymentAmount: true,
        },
      });

    return purchases.reduce(
      (sum, purchase) =>
        sum + Number(purchase.paymentAmount),
      0
    );
  };