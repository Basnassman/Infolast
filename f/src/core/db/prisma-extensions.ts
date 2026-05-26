import {
  Prisma,
  PrismaClient,
} from "@prisma/client";

export const withExtensions =
  (
    prisma: PrismaClient
  ) => {
    return prisma.$extends({
      query: {
        async $allOperations({
          operation,
          model,
          args,
          query,
        }) {
          const start =
            Date.now();

          const result =
            await query(args);

          const duration =
            Date.now() -
            start;

          console.log(
            `[DB] ${model}.${operation} (${duration}ms)`
          );

          return result;
        },
      },
    });
  };

export type ExtendedPrismaClient =
  ReturnType<
    typeof withExtensions
  >;