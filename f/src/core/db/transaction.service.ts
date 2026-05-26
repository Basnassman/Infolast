import {
  Prisma,
} from "@prisma/client";

import { prisma } from "./prisma";

export const transactionService =
  {
    async run<T>(
      callback: (
        tx: Prisma.TransactionClient
      ) => Promise<T>
    ): Promise<T> {
      return await prisma.$transaction(
        async (tx) => {
          return await callback(
            tx
          );
        }
      );
    },
  };