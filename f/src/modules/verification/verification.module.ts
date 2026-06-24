/**
 * =====================================================
 * VERIFICATION MODULE
 * =====================================================
 *
 * Independent, scalable verification system supporting
 * multiple platforms (Telegram, X, YouTube, Discord).
 *
 * Architecture:
 *   User → Tasks Module → Verification Module → Provider → Platform API
 *
 * Anti-fraud:
 *   - Reverification before claims
 *   - Reverification before vesting releases
 *   - Periodic reverification
 *   - Revoked status detection
 *
 * Usage from other modules:
 *   import { verificationEligibilityService } from "@modules/verification/services/eligibility.service";
 *   import { verificationService } from "@modules/verification/services/verification.service";
 */

// ─── Services ────────────────────────────────────────────────────────────────
export { verificationService } from "./services/verification.service";
export { verificationEligibilityService } from "./services/eligibility.service";
export { accountLinkingService } from "./services/account-linking.service";
export { reverificationService } from "./services/reverification.service";

// ─── Providers ───────────────────────────────────────────────────────────────
export { providerFactory } from "./providers/provider.factory";
export { TelegramProvider } from "./providers/telegram/telegram.provider";

// ─── Repositories ────────────────────────────────────────────────────────────
export { verificationTaskRepository } from "./repositories/verification-task.repository";
export { userVerificationTaskRepository } from "./repositories/user-verification-task.repository";
export { verificationLogRepository } from "./repositories/verification-log.repository";
export { platformAccountRepository } from "./repositories/platform-account.repository";

// ─── Queues ──────────────────────────────────────────────────────────────────
export { verificationQueue } from "./queues/verification.queue";
export { reverificationQueue } from "./queues/reverification.queue";

// ─── Types ───────────────────────────────────────────────────────────────────
export * from "./types/verification.types";

// ─── Errors ──────────────────────────────────────────────────────────────────
export * from "./errors/verification.errors";

// ─── Routes (for registration) ──────────────────────────────────────────────
export { default as verificationRoutes } from "./routes/verification.routes";
