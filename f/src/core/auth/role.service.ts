import { ethers } from "ethers";

import {
  airdropReadContract,
} from "@core/blockchain/contracts/airdrop-read.contract";

import {
  normalizeAddress,
} from "@core/auth/signature.service";

export const GOVERNANCE_ROLE =
  ethers.keccak256(
    ethers.toUtf8Bytes(
      "GOVERNANCE_ROLE"
    )
  );

export const OPERATOR_ROLE =
  ethers.keccak256(
    ethers.toUtf8Bytes(
      "OPERATOR_ROLE"
    )
  );

export const DEPOSITOR_ROLE =
  ethers.keccak256(
    ethers.toUtf8Bytes(
      "DEPOSITOR_ROLE"
    )
  );

export const DEFAULT_ADMIN_ROLE =
  ethers.ZeroHash;

export const hasRole =
  async (
    role: string,
    walletAddress: string
  ): Promise<boolean> => {
    try {
      return await airdropReadContract.hasRole(
        role,
        normalizeAddress(
          walletAddress
        )
      );
    } catch {
      return false;
    }
  };

export const isAdmin =
  async (
    walletAddress: string
  ): Promise<boolean> => {
    return hasRole(
      DEFAULT_ADMIN_ROLE,
      walletAddress
    );
  };

export const isGov =
  async (
    walletAddress: string
  ): Promise<boolean> => {
    const gov =
      await hasRole(
        GOVERNANCE_ROLE,
        walletAddress
      );

    if (gov) {
      return true;
    }

    return isAdmin(
      walletAddress
    );
  };

export const isOperator =
  async (
    walletAddress: string
  ): Promise<boolean> => {
    const operator =
      await hasRole(
        OPERATOR_ROLE,
        walletAddress
      );

    if (operator) {
      return true;
    }

    return isGov(
      walletAddress
    );
  };

export const isDepositor =
  async (
    walletAddress: string
  ): Promise<boolean> => {
    const depositor =
      await hasRole(
        DEPOSITOR_ROLE,
        walletAddress
      );

    if (depositor) {
      return true;
    }

    return isGov(
      walletAddress
    );
  };