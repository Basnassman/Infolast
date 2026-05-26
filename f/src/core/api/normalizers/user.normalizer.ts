export type NormalizeUserInput =
  {
    id: string;

    walletAddress: string;

    status: string;

    role?: string | null;

    createdAt: Date;

    updatedAt: Date;
  };

export const normalizeUser =
  (
    user: NormalizeUserInput
  ) => {
    return {
      id: user.id,

      walletAddress:
        user.walletAddress,

      status:
        user.status,

      role:
        user.role ??
        null,

      createdAt:
        user.createdAt,

      updatedAt:
        user.updatedAt,
    };
  };