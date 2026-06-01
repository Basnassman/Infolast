import { z } from "zod";
import { TaskPlatform, TaskType } from "@prisma/client";

export const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  points: z.number().int().min(1).max(100000),
  platform: z.nativeEnum(TaskPlatform),
  type: z.nativeEnum(TaskType).optional(),
  url: z.union([
    z.string().url(),      // ✅ URL صالح
    z.literal(""),         // ✅ string فارغ
    z.null(),              // ✅ null
  ]).optional().transform((val) => val === "" ? null : val), // ✅ حول "" إلى null
  isActive: z.boolean().optional(),
  maxSubmissions: z.number().int().min(1).optional(),
}).strict();

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  points: z.number().int().min(1).max(100000).optional(),
  platform: z.nativeEnum(TaskPlatform).optional(),
  type: z.nativeEnum(TaskType).optional(),
  url: z.union([
    z.string().url(),
    z.literal(""),
    z.null(),
  ]).optional().nullable().transform((val) => val === "" ? null : val),
  isActive: z.boolean().optional(),
  maxSubmissions: z.number().int().min(1).optional(),
}).strict();
