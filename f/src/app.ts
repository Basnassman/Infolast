import express from "express";
import cors from "cors";
import airdropRoutes from "./modules/airdrop/routes/airdrop.routes";
import purchaseRoutes from "./modules/purchase/routes/purchase.routes";
import vestingRoutes from "./modules/vesting/routes/vesting.routes";
import tasksRoutes from "./modules/tasks/routes/task.routes";
import adminRoutes from "./modules/admin/routes/admin.routes"; // ← جديد
import authRoutes from "./modules/auth/routes/auth.routes";
import './shared/types/global';
import { initCronJobs } from "./core/cron/cron-scheduler";

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/airdrop", airdropRoutes);
app.use("/api/purchase", purchaseRoutes);
app.use("/api/vesting", vestingRoutes);
app.use("/api/tasks", tasksRoutes);
app.use("/api/admin", adminRoutes); // ← جديد
app.use("/api/auth", authRoutes);

initCronJobs();


// Health Check
app.get("/health", (req, res) => {
res.json({ status: "ok", timestamp: new Date() });
});

export default app;