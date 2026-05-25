import { prisma } from "../../../core/db/prisma";

export async function getOrCreateUser(wallet: string) {
  const normalized = wallet.toLowerCase();

  let user = await prisma.user.findUnique({
    where: { wallet: normalized }
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        wallet: normalized,
        isBlocked: false
      }
    });
  }

  return user;
}