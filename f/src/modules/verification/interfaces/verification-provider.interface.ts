import { VerificationPlatform } from "@prisma/client";
import { VerifyContext, VerificationResult } from "../types/verification.types";

/**
 * Unified interface that all platform verification providers must implement.
 *
 * Each platform (Telegram, X, YouTube, Discord) provides its own implementation.
 * This ensures the Verification Module is decoupled from any specific platform.
 *
 * Example usage:
 *   const provider = providerFactory.get(VerificationPlatform.TELEGRAM);
 *   const result = await provider.verify(context);
 */
export interface VerificationProvider {
  /**
   * The platform this provider handles.
   */
  readonly platform: VerificationPlatform;

  /**
   * Verify that a user meets the requirements for a specific task.
   *
   * @param context - Contains userId, taskId, platform details, and metadata
   * @param canUseCache - When true, the provider may return a cached result
   *   (normal verification). When false, the provider MUST query the platform
   *   API live (reverification, claim gate, security-sensitive checks).
   * @returns VerificationResult with success/failure and details
   */
  verify(context: VerifyContext, canUseCache?: boolean): Promise<VerificationResult>;

  /**
   * Check if a user is currently a member of a channel/group.
   * Used for periodic reverification (I.3). Always live-checks.
   *
   * @param channelIdentifier - Platform-specific channel/group ID (optional in tests)
   * @param platformUserId - The user's platform-specific ID
   * @returns true if the user is still a valid member
   */
  checkMembership(
    channelIdentifier: string | undefined,
    platformUserId: string
  ): Promise<boolean>;
}
