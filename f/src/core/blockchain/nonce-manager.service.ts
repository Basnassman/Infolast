import { wallet } from "@core/blockchain/provider";

let nonceCache:
  | number
  | null = null;

export const getNextNonce =
  async (): Promise<number> => {
    if (!wallet) {
      throw new Error(
        "Wallet not configured"
      );
    }

    if (
      nonceCache === null
    ) {
      nonceCache =
        await wallet.getNonce(
          "pending"
        );
    } else {
      nonceCache += 1;
    }

    return nonceCache;
  };

export const resetNonceCache =
  () => {
    nonceCache = null;
  };