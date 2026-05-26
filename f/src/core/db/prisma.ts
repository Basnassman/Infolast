import { PrismaClient } from "@prisma/client";

import { withExtensions } from "./prisma-extensions";

declare global {
  // eslint-disable-next-line no-var
  var __prisma:
    | PrismaClient
    | undefined;
}

const prismaClient =
  global.__prisma ??
  new PrismaClient({
    log: [
      "warn",
      "error",
    ],
  });

export const prisma =
  withExtensions(
    prismaClient
  );

if (
  process.env.NODE_ENV !==
  "production"
) {
  global.__prisma =
    prismaClient;
}