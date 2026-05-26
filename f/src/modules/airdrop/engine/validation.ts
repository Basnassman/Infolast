import { ethers } from "ethers";

/**
 * =========================================
 * Address Validation
 * =========================================
 */

export const isValidWalletAddress =
  (
    walletAddress: string
  ): boolean => {
    return ethers.isAddress(
      walletAddress
    );
  };

export const normalizeWalletAddress =
  (
    walletAddress: string
  ): string => {
    return walletAddress.toLowerCase();
  };

export const toChecksumAddress =
  (
    walletAddress: string
  ): string => {
    return ethers.getAddress(
      walletAddress
    );
  };

/**
 * =========================================
 * Allocation Validation
 * =========================================
 */

export const isValidAllocationWei =
  (
    allocationWei: string
  ): boolean => {
    try {
      return (
        BigInt(allocationWei) > 0n
      );
    } catch {
      return false;
    }
  };

/**
 * =========================================
 * Merkle Validation
 * =========================================
 */

export const isValidMerkleLeaf =
  (
    leaf: string
  ): boolean => {
    return (
      typeof leaf === "string" &&
      leaf.startsWith("0x") &&
      leaf.length === 66
    );
  };

export const isValidMerkleRoot =
  (
    root: string
  ): boolean => {
    return (
      typeof root === "string" &&
      root.startsWith("0x") &&
      root.length === 66
    );
  };

export const isValidMerkleProof =
  (
    proof: string[]
  ): boolean => {
    if (
      !Array.isArray(proof)
    ) {
      return false;
    }

    return proof.every(
      (item) =>
        typeof item ===
          "string" &&
        item.startsWith("0x") &&
        item.length === 66
    );
  };

/**
 * =========================================
 * Claim Request Validation
 * =========================================
 */

export interface ClaimRequestInput {
  walletAddress: string;

  allocationWei: string;

  proof: string[];
}

export const validateClaimRequest =
  (
    input: ClaimRequestInput
  ): {
    valid: boolean;

    error?: string;
  } => {
    if (
      !isValidWalletAddress(
        input.walletAddress
      )
    ) {
      return {
        valid: false,

        error:
          "Invalid wallet address",
      };
    }

    if (
      !isValidAllocationWei(
        input.allocationWei
      )
    ) {
      return {
        valid: false,

        error:
          "Invalid allocation amount",
      };
    }

    if (
      !isValidMerkleProof(
        input.proof
      )
    ) {
      return {
        valid: false,

        error:
          "Invalid merkle proof",
      };
    }

    return {
      valid: true,
    };
  };
