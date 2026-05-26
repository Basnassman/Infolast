import { z } from "zod";

export const claimAirdropSchema =
  z.object({
    walletAddress:
      z
        .string()
        .trim()
        .toLowerCase()
        .startsWith("0x")
        .length(42),

    txHash:
      z
        .string()
        .trim()
        .startsWith("0x")
        .length(66),
  });

export type ClaimAirdropDto =
  z.infer<
    typeof claimAirdropSchema
  >;