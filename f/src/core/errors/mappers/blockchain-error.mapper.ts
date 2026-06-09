import { BlockchainError }
  from "@core/api/exceptions/blockchain.error";

export const mapBlockchainError =
  (
    error: any
  ): BlockchainError | null => {
    if (
      typeof error?.message !==
      "string"
    ) {
      return null;
    }

    const msg =
      error.message;

    if (
      msg.includes(
        "execution reverted"
      ) ||
      msg.includes(
        "CALL_EXCEPTION"
      ) ||
      msg.includes(
        "insufficient funds"
      )
    ) {
      return new BlockchainError(
        msg
      );
    }

    return null;
  };