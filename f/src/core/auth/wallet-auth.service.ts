import { Request } from "express";

import {
  normalizeAddress,
  verifySignature,
} from "../auth/signature.service";
import { AuthenticationError } from "@core/errors/domain/auth/authentication.error";

export type AuthWallet =
  {
    walletAddress: string;
    signature: string;
    message: string;
  };

export const extractWalletAuth =
  (
    req: Request
  ): AuthWallet => {
    const walletAddress =
      String(
        req.headers[
          "x-wallet-address"
        ] ||
          req.body
            ?.walletAddress ||
          req.query
            ?.walletAddress ||
          ""
      );

    const signature =
      String(
        req.headers[
          "x-signature"
        ] || ""
      );

    const message =
      String(
        req.headers[
          "x-message"
        ] || ""
      );

    if (
      !walletAddress
    ) {
      throw new AuthenticationError(
        "Wallet address is required"
      );
    }

    if (
      !signature
    ) {
      throw new AuthenticationError(
        "Signature is required"
      );
    }

    if (!message) {
      throw new AuthenticationError(
        "Message is required"
      );
    }

    return {
      walletAddress:
        normalizeAddress(
          walletAddress
        ),

      signature,

      message,
    };
  };

export const authenticateWallet =
  (
    req: Request
  ): string => {
    const auth =
      extractWalletAuth(
        req
      );

    const valid =
      verifySignature(
        auth.walletAddress,
        auth.message,
        auth.signature
      );

    if (!valid) {
      throw new AuthenticationError(
        "Invalid signature"
      );
    }

    return auth.walletAddress;
  };