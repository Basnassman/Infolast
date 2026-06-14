import { AppError } from "@core/errors/base/app-error";

export class AuthenticationError extends AppError {
  constructor(message = "Authentication failed") {
    super("AUTHENTICATION_ERROR", message, 401);
  }
}
