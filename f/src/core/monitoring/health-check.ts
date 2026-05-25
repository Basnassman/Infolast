import { Request, Response } from "express";
import { prisma } from "../db/prisma";

export const healthCheck = async (_: Request, res: Response) => {
  try {
    // اختبار DB
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      status: "ok",
      uptime: process.uptime(),
      db: "connected",
      timestamp: new Date(),
    });

  } catch (err) {
    res.status(500).json({
      status: "error",
      db: "disconnected",
    });
  }
};