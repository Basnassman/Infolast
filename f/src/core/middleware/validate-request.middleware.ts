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
          const response: ApiError = {
            success: false,

            error: {
              code: "VALIDATION_ERROR",

              message: error.issues
                .map((issue: any) => `${issue.path.join(".")}: ${issue.message}`)
                .join(", "),
            },
          };

          return res.status(400).json(response);
        }

        const response: ApiError = {
          success: false,

          error: {
            code: "INVALID_REQUEST",

            message: "Invalid request payload",
          },
        };

        return res.status(400).json(response);
      }
    };
  };