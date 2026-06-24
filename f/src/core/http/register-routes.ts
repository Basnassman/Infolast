import { Express } from "express";
import  authRoutes  from "@modules/auth/routes/auth.routes";
import  airdropRoutes  from "@modules/airdrop/routes/airdrop.routes";
import  adminRoutes  from "@modules/admin/routes/admin.routes";
import  taskRoutes from "@modules/tasks/routes/task.routes";import  purchaseRoutes  from "@modules/purchase/routes/purchase.routes";
import  vestingRoutes  from "@modules/vesting/routes/vesting.routes";
import  verificationRoutes  from "@modules/verification/routes/verification.routes";
import { telegramWebhookHandler } from "@core/telegram/telegram-webhook";
import { rebuildAndSync } from "@modules/airdrop/workers/rebuild.worker";
import { prometheusHandler } from "@core/monitoring/prometheus";
import { readinessHandler } from "@core/monitoring/readiness";
import { env } from "@core/config/env";


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
  const adminSecret = env.adminSecret;

  if (!adminSecret || secret !== adminSecret) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  try {
    const result = await rebuildAndSync();
    return res.json({ success: true, data: result });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
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

  app.use(
    "/api/v1/purchase",
    purchaseRoutes
  );

  app.use(
    "/api/v1/vesting",
    vestingRoutes
  );

  app.use(
    "/api/v1/verification",
    verificationRoutes
  );

  app.post(
    "/api/v1/telegram/webhook",
    telegramWebhookHandler
  );

app.get("/metrics", prometheusHandler);
app.get("/ready", readinessHandler);

};