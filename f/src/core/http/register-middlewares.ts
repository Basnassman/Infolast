import  express, { Express } from "express";
import { corsMiddleware,  } from "@core/security/cors";
import { helmetMiddleware } from "@core/security/helmet";
import { sanitizeMiddleware } from "@core/security/sanitize";
import compression from "compression";
import { requestIdMiddleware } from "@core/logger/request-id.middleware";
import { requestLogger } from "@core/logger/request-logger.middleware";

export const registerMiddlewares = (
  app: Express
): void => {

  app.use(corsMiddleware);

  app.use(helmetMiddleware);

  app.use(
    compression()
  );

  app.use(requestIdMiddleware);
  
  app.use(requestLogger);

  app.use(sanitizeMiddleware);

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