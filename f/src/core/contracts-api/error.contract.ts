export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "BLOCKED"
  | "INACTIVE"
  | "INVALID_PROOF"
  | "ALREADY_CLAIMED"
  | "INTERNAL_ERROR";

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