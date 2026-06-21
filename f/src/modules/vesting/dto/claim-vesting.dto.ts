import { ValidationError } from "@core/api/exceptions/validation.error";

/**
 * =====================================================
 * CLAIM VESTING DTO
 * =====================================================
 *
 * Validates the POST /api/v1/vesting/claim request body.
 *
 * Expected shape:
 * {
 *   wallet: "0x...",
 *   txHash: "0x...",
 *   amountWei: "25000000000000000000"
 * }
 */

export type ClaimVestingInput = {
  wallet: string;
  txHash: string;
  amountWei: string;
};

const ETH_ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;
const TX_HASH_REGEX = /^0x[0-9a-fA-F]{64}$/;
const WEI_REGEX = /^[0-9]+$/;

export const validateClaimVesting = (body: any): ClaimVestingInput => {
  const { wallet, txHash, amountWei } = body;

  if (!wallet || typeof wallet !== "string") {
    throw new ValidationError("wallet is required and must be a string");
  }

  if (!txHash || typeof txHash !== "string") {
    throw new ValidationError("txHash is required and must be a string");
  }

  if (!amountWei || typeof amountWei !== "string") {
    throw new ValidationError("amountWei is required and must be a string");
  }

  if (!ETH_ADDRESS_REGEX.test(wallet)) {
    throw new ValidationError("wallet must be a valid Ethereum address (0x...)");
  }

  if (!TX_HASH_REGEX.test(txHash)) {
    throw new ValidationError("txHash must be a valid transaction hash (0x...)");
  }

  if (!WEI_REGEX.test(amountWei)) {
    throw new ValidationError("amountWei must be a numeric string in wei");
  }

  if (BigInt(amountWei) <= 0n) {
    throw new ValidationError("amountWei must be greater than 0");
  }

  return {
    wallet: wallet.toLowerCase(),
    txHash: txHash.toLowerCase(),
    amountWei,
  };
};
