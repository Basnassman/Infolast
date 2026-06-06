import {
  Express,
} from "express";

import authRoutes from "../../modules/auth/routes/auth.routes";

import airdropRoutes from "../../modules/airdrop/routes/airdrop.routes";

import adminRoutes from "../../modules/admin/routes/admin.routes";

import taskRoutes from "../../modules/tasks/routes/task.routes";

import { rebuildAndSync } from "../../modules/airdrop/workers/rebuild.worker";

export const registerRoutes = (
  app: Express
): void => {
  app.get(
    "/health",
    (_, res) => {
      return res.json({
        success: true,
        data: {
          status: "ok",
        },
      });
    }
  );


  app.post("/api/v1/internal/rebuild", async (req, res) => {
  const secret = req.headers["x-admin-secret"];
  if (secret !== process.env.ADMIN_SECRET || 100000 ) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  const result = await rebuildAndSync();
  return res.json({ success: true, data: result });
  });


  app.use(
    "/api/v1/auth",
    authRoutes
  );

  app.use(
    "/api/v1/airdrop",
    airdropRoutes
  );

  app.use(
    "/api/v1/tasks",
    taskRoutes
  );

  app.use(
    "/api/v1/admin",
    adminRoutes
  );
};