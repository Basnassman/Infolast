import {
  Request,
  Response,
  NextFunction,
} from "express";

import {
  z,
  ZodSchema,
} from "zod";

import {
  ApiError,
} from "../../core/contracts-api/error.contract";

const sendValidationError = (
  res: Response,
  message: string
) => {
  const response: ApiError = {
    success: false,

    error: {
      code: "VALIDATION_ERROR",

      message,
    },
  };

  return res.status(400).json(response);
};

/**
 * Validate req.body (POST/PUT/PATCH)
 */
export const validateRequest =
  <T>(
    schema: ZodSchema<T>
  ) => {
    return (
      req: Request,
      res: Response,
      next: NextFunction
    ) => {
      try {
        req.body = schema.parse(req.body);

        next();
      } catch (error) {
        if (error instanceof z.ZodError) {
          return sendValidationError(
            res,
            error.issues
              .map((issue: any) => `${issue.path.join(".")}: ${issue.message}`)
              .join(", ")
          );
        }

        return sendValidationError(
          res,
          "Invalid request payload"
        );
      }
    };
  };

/**
 * Validate req.query (GET routes)
 */
export const validateQuery =
  <T>(
    schema: ZodSchema<T>
  ) => {
    return (
      req: Request,
      res: Response,
      next: NextFunction
    ) => {
      try {
        const parsed = schema.parse(req.query);
        (req as any).validatedQuery = parsed;

        next();
      } catch (error) {
        if (error instanceof z.ZodError) {
          return sendValidationError(
            res,
            error.issues
              .map((issue: any) => `${issue.path.join(".")}: ${issue.message}`)
              .join(", ")
          );
        }

        return sendValidationError(
          res,
          "Invalid query parameters"
        );
      }
    };
  };