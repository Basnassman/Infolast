import { Request, Response } from "express";

import { prisma } from "../../../core/db/prisma";

import { processTaskExecution } from "../workers/task-worker";

import { getOrCreateUser } from "../../user/utils/user";

/**
 * 📋 List active tasks
 */
export const listTasks = async (
  req: Request,
  res: Response
) => {
  try {
    const tasks =
      await prisma.task.findMany({
        where: {
          isActive: true,
        },

        orderBy: {
          points: "desc",
        },
      });

    return res.json({
      success: true,
      tasks,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * ✅ Complete task
 */
export const completeTask = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      wallet,
      taskId,
      proof,
    } = req.body;

    if (!wallet || !taskId) {
      return res.status(400).json({
        success: false,
        error:
          "wallet and taskId are required",
      });
    }

    const normalizedWallet =
      wallet.toLowerCase();

    const ip =
      req.ip || "0.0.0.0";

    const userAgent =
      req.get("User-Agent") || undefined;

    const user =
      await getOrCreateUser(
        normalizedWallet
      );

    if (user.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        error:
          "User is not active",
      });
    }

    const result =
      await processTaskExecution(
        user.id,
        taskId,
        ip,
        userAgent,
        proof
      );

    return res.json({
      success: true,

      status: result.status,

      verified:
        result.verified,

      rewardGiven:
        result.rewardGiven,

      points:
        result.points,

      riskScore:
        result.riskScore,
    });
  } catch (error: any) {
    console.error(
      "[TaskController]",
      error
    );

    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * 📊 Get user task status
 */
export const getStatus = async (
  req: Request,
  res: Response
) => {
  try {
    const wallet =
      req.query.wallet;

    if (
      !wallet ||
      typeof wallet !== "string"
    ) {
      return res.status(400).json({
        success: false,
        error:
          "wallet is required",
      });
    }

    const user =
      await prisma.user.findUnique({
        where: {
          walletAddress:
            wallet.toLowerCase(),
        },

        include: {
          userTasks: {
            include: {
              task: true,
            },

            orderBy: {
              completedAt: "desc",
            },
          },
        },
      });

    if (!user) {
      return res.json({
        success: true,
        tasks: [],
      });
    }

    return res.json({
      success: true,
      tasks: user.userTasks,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export const tasksController = {
  listTasks,

  completeTask,

  getStatus,
};