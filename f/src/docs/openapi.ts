import {
  OpenAPIV3,
} from "openapi-types";

export const openApiDocument:
  OpenAPIV3.Document =
  {
    openapi: "3.0.0",

    info: {
      title:
        "Airdrop API",

      version: "1.0.0",
    },

    servers: [
      {
        url:
          "http://localhost:3000/api",
      },
    ],

    paths: {},
  };