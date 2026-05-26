export type ErrorCode = string;

export type ApiError = {
  success: false;

  error: {
    code: ErrorCode;

    message: string;

    details?: unknown;
  };
};

export type ValidationErrorItem = {
  field: string;

  message: string;
};

export type ValidationApiError = {
  success: false;

  error: {
    code: "VALIDATION_ERROR";

    message: string;

    fields: ValidationErrorItem[];
  };
};