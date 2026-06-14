import { AppError } from "@core/errors/base/app-error";

export class AlreadyClaimedError extends AppError {
  constructor(message = "Tokens have already been claimed") {
    super("ALREADY_CLAIMED", message, 409);
  }
}
