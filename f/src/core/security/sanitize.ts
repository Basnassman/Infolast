import {
  Request,
  Response,
  NextFunction,
} from "express";

const sanitizeObject =
  (
    value: unknown
  ): unknown => {
    if (
      typeof value ===
      "string"
    ) {
      return value
        .replace(
          /<script.*?>.*?<\/script>/gi,
          ""
        )
        .trim();
    }

    if (
      Array.isArray(value)
    ) {
      return value.map(
        sanitizeObject
      );
    }

    if (
      typeof value ===
        "object" &&
      value !== null
    ) {
      const result:
        Record<
          string,
          unknown
        > = {};

      for (const [
        key,
        val,
      ] of Object.entries(
        value
      )) {
        result[key] =
          sanitizeObject(
            val
          );
      }

      return result;
    }

    return value;
  };

export const sanitizeMiddleware =
  (
    req: Request,
    _: Response,
    next: NextFunction
  ) => {
    req.body =
      sanitizeObject(
        req.body
      );

    req.query =
      sanitizeObject(
        req.query
      ) as Request["query"];

    next();
  };