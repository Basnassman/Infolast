import {
  UserStatus,
} from "@prisma/client";

import { prisma } from "../../../core/db/prisma";

import {
  getActiveMerkleRoot,
  getProofByWallet,
} from "../repositories/claim.repository";

import {
  verifyProof,
} from "../merkle/tree.service";

export interface ClaimValidationResult {
  valid: boolean;

  reason?: string;

  amountWei?: string;

  proof?: string[];

  merkleRoot?: string;

  merkleRootId?: string;
}

export const validateClaim =
  async (
    walletAddress: string
  ): Promise<ClaimValidationResult> => {
    const normalized =
      walletAddress.toLowerCase();

    // 1️⃣ user
    const user =
      await prisma.user.findUnique({
        where: {
          walletAddress:
            normalized,
        },

        select: {
          id: true,

          status: true,
        },
      });

    if (!user) {
      return {
        valid: false,
        reason: "User not found",
      };
    }

    if (
      user.status !==
      UserStatus.ACTIVE
    ) {
      return {
        valid: false,
        reason:
          "User is not active",
      };
    }

    // 2️⃣ active root
    const activeRoot =
      await getActiveMerkleRoot();

    if (!activeRoot) {
      return {
        valid: false,
        reason:
          "No active merkle root",
      };
    }

    // 3️⃣ proof
    const proof =
      await getProofByWallet(
        activeRoot.id,
        normalized
      );

    if (!proof) {
      return {
        valid: false,
        reason:
          "Proof not found",
      };
    }

    if (
      BigInt(proof.amountWei) <= 0n
    ) {
      return {
        valid: false,
        reason:
          "Invalid allocation",
      };
    }

    // 4️⃣ already claimed
    const existingClaim =
      await prisma.distributionClaim.findFirst({
        where: {
          userId: user.id,

          merkleRootId:
            activeRoot.id,

          status: {
            in: [
              "PENDING",
              "COMPLETED",
            ],
          },
        },
      });

    if (existingClaim) {
      return {
        valid: false,
        reason:
          "Already claimed",
      };
    }

    // 5️⃣ verify proof
    const verified =
      verifyProof(
        activeRoot.root,
        proof.leaf,
        proof.proof
      );

    if (!verified) {
      return {
        valid: false,
        reason:
          "Invalid merkle proof",
      };
    }

    return {
      valid: true,

      amountWei:
        proof.amountWei,

      proof:
        proof.proof,

      merkleRoot:
        activeRoot.root,

      merkleRootId:
        activeRoot.id,
    };
  };
