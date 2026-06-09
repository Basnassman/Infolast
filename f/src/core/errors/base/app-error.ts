import { AppError as LegacyAppError }
  from "@core/api/exceptions/app.error";

export class AppError extends LegacyAppError {
  constructor(
    code: string,
    message: string,
    statusCode = 400
  ) {
    super(
      code,
      message,
      statusCode
    );
  }
}