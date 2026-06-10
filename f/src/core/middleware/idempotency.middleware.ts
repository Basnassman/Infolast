import {
  Request,
  Response,
  NextFunction,
} from "express";

import { idempotencyCache } from "@core/cache/stores/idempotency-cache";

export const idempotencyMiddleware =
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const key =
      req.headers[
        "idempotency-key"
      ];

    if (
      !key ||
      typeof key !== "string"
    ) {
      return res.status(400).json({
        success: false,

        error: {
          code:
            "IDEMPOTENCY_KEY_REQUIRED",

          message:
            "Idempotency key is required",
        },
      });
    }

    const exists =
      await idempotencyCache.exists(
        key
      );

    if (exists) {
      return res.status(409).json({
        success: false,

        error: {
          code:
            "DUPLICATE_REQUEST",

          message:
            "Duplicate request detected",
        },
      });
    }

    await idempotencyCache.mark(
      key
    );

    next();
  };