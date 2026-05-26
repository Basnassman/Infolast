import { logger } from "./logger";

export const logError = (
  error: unknown,
  context?: Record<string, any>
): void => {
  logger.error({
    error,
    context,
  });
};