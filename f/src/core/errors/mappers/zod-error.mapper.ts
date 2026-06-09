import { ZodError } from "zod";

import { ValidationError }
  from "@core/api/exceptions/validation.error";

export const mapZodError = (
  error: ZodError
): ValidationError => {
  const message =
    error.issues
      .map(
        (e) =>
          `${e.path.join(".")}: ${e.message}`
      )
      .join(", ");

  return new ValidationError(
    message || "Validation failed"
  );
};