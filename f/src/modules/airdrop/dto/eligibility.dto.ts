import { z } from "zod";

export const eligibilitySchema =
  z.object({
    walletAddress:
      z
        .string()
        .trim()
        .toLowerCase()
        .startsWith("0x")
        .length(42),
  });

export type EligibilityDto =
  z.infer<
    typeof eligibilitySchema
  >;