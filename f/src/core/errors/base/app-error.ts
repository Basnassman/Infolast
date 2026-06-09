export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 500
  ) {
    super(message);

    this.name = this.constructor.name;

    Error.captureStackTrace(
      this,
      this.constructor
    );
  }
}