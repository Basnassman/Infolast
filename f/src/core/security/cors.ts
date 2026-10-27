import cors, { CorsOptions } from "cors";
import { env } from "@core/config/env";
import { logger } from "@core/logger/logger";
import { normalizeOrigin } from "./origin";

/**
 * =====================================================
 * CORS
 * =====================================================
 *
 * Allowlist comes from CORS_ORIGIN (comma-separated).
 *
 * Origin matching is normalized (no trailing slash, lowercase) because
 * browsers never send a trailing slash in the Origin header. Configuring
 * `CORS_ORIGIN=https://app.netlify.app/` previously produced no
 * Access-Control-Allow-Origin header at all and every browser request
 * failed with a CORS error.
 *
 * `credentials: true` is only ever combined with an explicit allowlist.
 * When CORS_ORIGIN is unset in production we deny cross-origin requests
 * (and log loudly) instead of reflecting arbitrary origins.
 */

const allowlist = env.corsOrigin;

if (allowlist === null) {
  if (env.isProduction) {
    logger.error(
      "[CORS] CORS_ORIGIN is not set in production — cross-origin browser requests will be rejected. " +
        "Set e.g. CORS_ORIGIN=https://frontendco.netlify.app (comma-separated for multiple sites)."
    );
  } else {
    logger.warn(
      "[CORS] CORS_ORIGIN is not set — reflecting any origin (development only)"
    );
  }
} else {
  logger.info({ origins: allowlist }, "[CORS] Allowed origins");
}

const originOption: CorsOptions["origin"] =
  allowlist === null
    ? // No explicit allowlist: reflect in development, deny in production.
      !env.isProduction
    : (requestOrigin, callback) => {
        // No Origin header (server-to-server, curl, same-origin) → allow.
        if (!requestOrigin) return callback(null, true);

        const allowed = allowlist.includes(normalizeOrigin(requestOrigin));

        if (!allowed) {
          logger.warn(
            { origin: requestOrigin, allowed: allowlist },
            "[CORS] Blocked origin"
          );
        }

        return callback(null, allowed);
      };

export const corsMiddleware = cors({
  origin: originOption,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Accept",
    "Origin",
    "x-wallet-address",
    "x-signature",
    "x-message",
    "x-request-id",
    "idempotency-key",
    "x-admin-secret",
  ],
  exposedHeaders: ["x-request-id", "Retry-After"],
  optionsSuccessStatus: 204,
  maxAge: 600,
});
