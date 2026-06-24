import { VerificationPlatform } from "@prisma/client";
import { VerificationProvider } from "../interfaces/verification-provider.interface";
import { TelegramProvider } from "./telegram/telegram.provider";
import { ProviderNotAvailableError } from "../errors/verification.errors";
import { logger } from "@core/logger/logger";

/**
 * Provider Factory
 *
 * Central registry for all VerificationProvider implementations.
 * New platforms are added here — no changes needed elsewhere.
 *
 * Usage:
 *   const provider = providerFactory.get(VerificationPlatform.TELEGRAM);
 *   const result = await provider.verify(context);
 */
class ProviderFactory {
  private providers = new Map<VerificationPlatform, VerificationProvider>();

  constructor() {
    this.register(new TelegramProvider());
    // Future providers:
    // this.register(new XProvider());
    // this.register(new YouTubeProvider());
    // this.register(new DiscordProvider());
  }

  register(provider: VerificationProvider): void {
    this.providers.set(provider.platform, provider);
    logger.info(
      { platform: provider.platform },
      "[ProviderFactory] Registered verification provider"
    );
  }

  get(platform: VerificationPlatform): VerificationProvider {
    const provider = this.providers.get(platform);
    if (!provider) {
      throw new ProviderNotAvailableError(platform);
    }
    return provider;
  }

  has(platform: VerificationPlatform): boolean {
    return this.providers.has(platform);
  }

  getAvailablePlatforms(): VerificationPlatform[] {
    return Array.from(this.providers.keys());
  }
}

export const providerFactory = new ProviderFactory();
