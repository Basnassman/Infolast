import {
  provider,
} from "../../../core/blockchain/provider";

import {
  markClaimCompleted,
  markClaimFailed,
} from "../repositories/claim.repository";

export const syncClaimTransaction =
  async (
    claimId: string,
    txHash: string
  ) => {
    try {
      const receipt =
        await provider.waitForTransaction(
          txHash
        );

      if (
        !receipt ||
        receipt.status !== 1
      ) {
        await markClaimFailed(
          claimId,
          "Transaction failed"
        );

        return {
          success: false,
        };
      }

      await markClaimCompleted(
        claimId,
        txHash
      );

      return {
        success: true,
      };
    } catch (error: any) {
      await markClaimFailed(
        claimId,
        error.message
      );

      return {
        success: false,
        error: error.message,
      };
    }
  };
