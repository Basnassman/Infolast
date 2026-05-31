import { z } from "zod";
import { TaskPlatform, TaskType } from "@prisma/client";

export const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  points: z.number().int().min(1).max(100000),
  platform: z.nativeEnum(TaskPlatform),
  type: z.nativeEnum(TaskType).optional(),
  url: z.string().url().optional(),
  isActive: z.boolean().optional(),
  maxSubmissions: z.number().int().min(1).optional(),
}).strict();

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  points: z.number().int().min(1).max(100000).optional(),
  platform: z.nativeEnum(TaskPlatform).optional(),
  type: z.nativeEnum(TaskType).optional(),
  url: z.string().url().optional().nullable(),
  isActive: z.boolean().optional(),
  maxSubmissions: z.number().int().min(1).optional(),
}).strict();
