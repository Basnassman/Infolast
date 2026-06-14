import { z } from "zod";

export const walletQuerySchema = z.object({
  walletAddress: z
    .string()
    .trim()
    .toLowerCase()
    .startsWith("0x")
    .length(42),
});

export type WalletQueryDto = z.infer<typeof walletQuerySchema>;
