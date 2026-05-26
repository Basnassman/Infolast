import { ethers } from "ethers";

export const waitForTransaction =
  async (
    tx:
      | ethers.TransactionResponse
  ) => {
    const receipt =
      await tx.wait();

    if (
      !receipt ||
      receipt.status !== 1
    ) {
      throw new Error(
        "Transaction failed"
      );
    }

    return receipt;
  };