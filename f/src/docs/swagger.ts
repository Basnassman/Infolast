import swaggerUi from "swagger-ui-express";

import { Express } from "express";

import { openApiDocument } from "@docs/openapi";

export const registerSwagger =
  (
    app: Express
  ) => {
    app.use(
      "/docs",

      swaggerUi.serve,

      swaggerUi.setup(
        openApiDocument
      )
    );
  };