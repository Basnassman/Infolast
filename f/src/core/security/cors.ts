import cors from "cors";
import { env } from "@core/config/env";

export const corsMiddleware = cors({
  // إذا كان CORS_ORIGIN=* نحوله لـ true (reflect mode) تلقائياً
  origin: env.corsOrigin === "*" ? true : env.corsOrigin,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization", 
    "x-wallet-address",
    "x-signature",
    "x-message",
    "idempotency-key",
    "x-admin-secret",
  ],
});