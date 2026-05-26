import {
  Response,
} from "express";

import {
  ApiError,
} from "@core/contracts-api/error.contract";

export const errorResponse =
  (
    res: Response,
    code: string,
    message: string,
    statusCode = 400,
    details?: unknown
  ) => {
    const response: ApiError =
      {
        success: false,

        error: {
          code,

          message,

          details,
        },
      };

    return res
      .status(
        statusCode
      )
      .json(
        response
      );
  };