import { claimQueue } from "../queue";

export const enqueueClaim =
  async (
    walletAddress: string,
    txHash: string
  ) => {
    return await claimQueue.add(
      "claim-sync",

      {
        walletAddress,
        txHash,
      },

      {
        removeOnComplete: 100,

        removeOnFail: 50,
      }
    );
  };