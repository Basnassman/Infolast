/**
 * Verification Module - Custom Error Classes
 *
 * All errors extend a base VerificationError for consistent error handling.
 */

export class VerificationError extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "VerificationError";
    this.code = code;
  }
}

// ─── Task Errors ─────────────────────────────────────────────────────────────

export class VerificationTaskNotFoundError extends VerificationError {
  constructor(taskId: string) {
    super("VERIFICATION_TASK_NOT_FOUND", `Verification task not found: ${taskId}`);
    this.name = "VerificationTaskNotFoundError";
  }
}

export class VerificationTaskInactiveError extends VerificationError {
  constructor(taskId: string) {
    super("VERIFICATION_TASK_INACTIVE", `Verification task is inactive: ${taskId}`);
    this.name = "VerificationTaskInactiveError";
  }
}

export class VerificationTaskAlreadyVerifiedError extends VerificationError {
  constructor(userId: string, taskId: string) {
    super("VERIFICATION_ALREADY_VERIFIED", `User ${userId} is already verified for task ${taskId}`);
    this.name = "VerificationTaskAlreadyVerifiedError";
  }
}

// ─── Platform Account Errors ─────────────────────────────────────────────────

export class PlatformAccountNotLinkedError extends VerificationError {
  constructor(userId: string, platform: string) {
    super("PLATFORM_ACCOUNT_NOT_LINKED", `Platform account not linked for user ${userId} on ${platform}`);
    this.name = "PlatformAccountNotLinkedError";
  }
}

export class PlatformAccountAlreadyLinkedError extends VerificationError {
  constructor(userId: string, platform: string) {
    super("PLATFORM_ACCOUNT_ALREADY_LINKED", `Platform account already linked for user ${userId} on ${platform}`);
    this.name = "PlatformAccountAlreadyLinkedError";
  }
}

// ─── Deep Link Errors ────────────────────────────────────────────────────────

export class DeepLinkTokenExpiredError extends VerificationError {
  constructor(token: string) {
    super("DEEP_LINK_TOKEN_EXPIRED", `Deep link token has expired: ${token}`);
    this.name = "DeepLinkTokenExpiredError";
  }
}

export class DeepLinkTokenInvalidError extends VerificationError {
  constructor(token: string) {
    super("DEEP_LINK_TOKEN_INVALID", `Invalid deep link token: ${token}`);
    this.name = "DeepLinkTokenInvalidError";
  }
}

export class DeepLinkTokenAlreadyUsedError extends VerificationError {
  constructor(token: string) {
    super("DEEP_LINK_TOKEN_USED", `Deep link token already used: ${token}`);
    this.name = "DeepLinkTokenAlreadyUsedError";
  }
}

// ─── Provider Errors ─────────────────────────────────────────────────────────

export class ProviderNotAvailableError extends VerificationError {
  constructor(platform: string) {
    super("PROVIDER_NOT_AVAILABLE", `Verification provider not available for platform: ${platform}`);
    this.name = "ProviderNotAvailableError";
  }
}

export class ProviderAPIError extends VerificationError {
  constructor(platform: string, detail: string) {
    super("PROVIDER_API_ERROR", `[${platform}] API error: ${detail}`);
    this.name = "ProviderAPIError";
  }
}

// ─── Eligibility Errors ──────────────────────────────────────────────────────

export class NotEligibleError extends VerificationError {
  constructor(userId: string, reason: string) {
    super("NOT_ELIGIBLE", `User ${userId} is not eligible: ${reason}`);
    this.name = "NotEligibleError";
  }
}

// ─── Rate Limit Errors ───────────────────────────────────────────────────────

export class VerificationRateLimitError extends VerificationError {
  constructor(userId: string) {
    super("VERIFICATION_RATE_LIMIT", `Rate limit exceeded for user ${userId}`);
    this.name = "VerificationRateLimitError";
  }
}
