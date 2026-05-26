import { ethers } from "ethers";

export const normalizeAddress = (
  address: string
): string => {
  return ethers.getAddress(address).toLowerCase();
};

export const recoverAddress = (
  message: string,
  signature: string
): string => {
  const recovered =
    ethers.verifyMessage(
      message,
      signature
    );

  return normalizeAddress(
    recovered
  );
};

export const verifySignature = (
  walletAddress: string,
  message: string,
  signature: string
): boolean => {
  try {
    const recovered =
      recoverAddress(
        message,
        signature
      );

    return (
      recovered ===
      normalizeAddress(
        walletAddress
      )
    );
  } catch {
    return false;
  }
};