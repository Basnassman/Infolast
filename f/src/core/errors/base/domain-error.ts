import { AppError } from "@core/api/exceptions/app.error";

export class DomainError extends AppError {
  constructor(
    code: string,
    message: string,
    statusCode = 400
  ) {
    super(code, message, statusCode);
    this.name = this.constructor.name;
  }
}