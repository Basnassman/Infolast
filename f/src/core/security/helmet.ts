import helmet from "helmet";

export const helmetMiddleware =
  helmet({
    crossOriginResourcePolicy:
      false,
  });