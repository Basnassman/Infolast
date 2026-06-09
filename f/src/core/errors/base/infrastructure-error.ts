import { AppError } from "./app-error";

export class InfrastructureError extends AppError {
  constructor(
    code: string,
    message: string,
    statusCode = 500
  ) {
    super(
      code,
      message,
      statusCode
    );
  }
}