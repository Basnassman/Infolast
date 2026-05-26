import { AppError } from "./app.error";

export class ConflictError extends AppError {
  constructor(message = "Resource conflict") {
    super("CONFLICT", message, 409);
  }
}

export default ConflictError;
