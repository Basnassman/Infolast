import express from "express";

import {
  registerMiddlewares,
} from "./core/http/register-middlewares";

import {
  registerRoutes,
} from "./core/http/register-routes";

import {
  registerErrors,
} from "./core/http/register-errors";

const app = express();

registerMiddlewares(app);

registerRoutes(app);

registerErrors(app);

export default app;