// src/controllers/task.controller.ts
import { Request, Response } from "express";
import { prisma } from "../../../core/db/prisma";
import { processTaskExecution } from "../workers/task-worker";
import { getOrCreateUser } from "../../user/utils/user";

export const listTasks = async (req: Request, res: Response) => {
  try {
    const tasks = await prisma.task.findMany({
      where: { isActive: true },
      orderBy: { points: 'desc' }
    });

    res.json(tasks);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const completeTask = async (req: Request, res: Response) => {
  try {
    const { wallet, taskId, proof } = req.body;

    if (!wallet || !taskId) {
      return res.status(400).json({ error: "wallet and taskId are required" });
    }

    const ip = req.ip || "0.0.0.0";
    const userAgent = req.get("User-Agent");

    const user = await getOrCreateUser(wallet);

    if (user.isBlocked) {
      return res.status(403).json({ error: "User is blocked" });
    }

    const result = await processTaskExecution(
      user.id,
      taskId,
      ip,
      userAgent,
      proof
    );

    res.json({
      success: true,
      status: result.status,
      riskScore: result.riskScore,
      verified: result.verified
    });

  } catch (err: any) {
    console.error("completeTask error:", err);
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
};

export const getStatus = async (req: Request, res: Response) => {
  try {
    const { wallet } = req.query;

    if (!wallet || typeof wallet !== "string") {
      return res.status(400).json({ error: "wallet is required" });
    }

    const user = await prisma.user.findUnique({
      where: { wallet: wallet.toLowerCase() },
      include: {
        userTasks: {
          include: { task: true }
        }
      }
    });

    if (!user) {
      return res.json([]);
    }

    res.json(user.userTasks);

  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

export const tasksController = {
  listTasks,
  completeTask,
  getStatus,
};
