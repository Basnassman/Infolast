export class AppError extends Error {
  public code: string;
  public statusCode: number;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.name = this.constructor.name;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export default AppError;
