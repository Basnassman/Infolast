import { prisma } from "@core/db/prisma";
import { UserStatus } from "@prisma/client";

/**
 * Normalize wallet address
 */
export const normalizeWallet = (
  wallet: string
): string => {
  return wallet.trim().toLowerCase();
};

/**
 * Get existing user by wallet
 */
export const getUserByWallet = async (
  wallet: string
) => {
  return prisma.user.findUnique({
    where: {
      walletAddress: normalizeWallet(wallet),
    },
  });
};

/**
 * Create new user
 */
export const createUser = async (
  wallet: string
) => {
  return prisma.user.create({
    data: {
      walletAddress: normalizeWallet(wallet),
      status: UserStatus.ACTIVE,
    },
  });
};

/**
 * Get or create user
 */
export const getOrCreateUser = async (
  wallet: string
) => {
  const normalized =
    normalizeWallet(wallet);

  let user =
    await prisma.user.findUnique({
      where: {
        walletAddress: normalized,
      },
    });

  if (!user) {
    user = await prisma.user.create({
      data: {
        walletAddress: normalized,
        status: UserStatus.ACTIVE,
      },
    });
  }

  return user;
};

/**
 * Check if user is blocked
 */
export const isUserBlocked = (
  status: UserStatus
): boolean => {
  return (
    status === UserStatus.BLOCKED ||
    status === UserStatus.SUSPENDED
  );
};