import {
  Express,
} from "express";

import {
  globalErrorMiddleware,
} from "../middleware/global-error.middleware";

export const registerErrors = (
  app: Express
): void => {
  app.use(
    globalErrorMiddleware
  );
};