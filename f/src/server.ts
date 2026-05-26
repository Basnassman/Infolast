import app from "@src/app";

import {
  env,
} from "@core/config/env";

const server =
  app.listen(
    env.port,
    () => {
      console.log(
        `🚀 Server running on port ${env.port}`
      );
    }
  );

const shutdown = (
  signal: string
) => {
  console.log(
    `\n${signal} received. Shutting down...`
  );

  server.close(() => {
    console.log(
      "HTTP server closed"
    );

    process.exit(0);
  });
};

process.on(
  "SIGINT",
  () => shutdown("SIGINT")
);

process.on(
  "SIGTERM",
  () => shutdown("SIGTERM")
);