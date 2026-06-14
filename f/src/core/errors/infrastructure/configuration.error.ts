import { AppError } from "@core/errors/base/app-error";

export class ConfigurationError extends AppError {
  constructor(message = "Service configuration is missing") {
    super("CONFIGURATION_ERROR", message, 500);
  }
}
