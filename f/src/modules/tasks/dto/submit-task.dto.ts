import { z } from "zod";

export const submitTaskSchema = z.object({
  taskId: z.string(),
  walletAddress: z.string(),
});

export type SubmitTaskDto = z.infer<typeof submitTaskSchema>;
