import cors from "cors";

import { env } from "@core/config/env";

export const corsMiddleware =
  cors({
    origin:
      env.corsOrigin,

    credentials: true,
  });