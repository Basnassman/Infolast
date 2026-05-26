import express, {
  Express,
} from "express";

import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { requestIdMiddleware } from "@core/logger/request-id.middleware";

import { requestLogger } from "@core/logger/request-logger.middleware";

export const registerMiddlewares = (
  app: Express
): void => {
  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );

  app.use(
    helmet()
  );

  app.use(
    compression()
  );

  app.use(
  requestIdMiddleware
);

app.use(
  requestLogger
);

  app.use(
    express.json({
      limit: "1mb",
    })
  );

  app.use(
    express.urlencoded({
      extended: true,
    })
  );

  app.disable(
    "x-powered-by"
  );
};