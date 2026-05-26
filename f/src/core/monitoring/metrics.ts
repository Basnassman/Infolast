import client from "prom-client";

client.collectDefaultMetrics();

export const httpRequests =
  new client.Counter({
    name:
      "http_requests_total",

    help:
      "Total HTTP requests",

    labelNames: [
      "method",
      "route",
      "status",
    ],
  });

export const blockchainTxs =
  new client.Counter({
    name:
      "blockchain_transactions_total",

    help:
      "Total blockchain txs",
  });

export const metricsRegistry =
  client.register;