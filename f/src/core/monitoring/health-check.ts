import { prisma } from "@core/db/prisma";

import { redis } from "@core/cache/redis";

import { checkProviderNetwork } from "@core/blockchain/chain-guard";

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export interface HealthCheckResult {
  status: HealthStatus;
  checks: {
    database: "ok" | "failed";
    redis: "ok" | "failed";
    rpc: "ok" | "failed";
  };
  network?: {
    name: string;
    chainId: number | null;
    expectedChainId: number;
    expectedChainIdHex: string;
  };
  error?: string;
}

/**
 * =====================================================
 * READINESS
 * =====================================================
 *
 * - database / redis down → "unhealthy" (503; cannot serve requests)
 * - RPC unreachable or wrong chain → "degraded" (200, but visible)
 *
 * An RPC outage should not make the platform restart-loop, while a wrong
 * network is still reported loudly (and blocks the indexers via
 * assertSepoliaNetwork()).
 */
export const healthCheck = async (): Promise<HealthCheckResult> => {
  let databaseOk = true;
  let redisOk = true;

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    databaseOk = false;
  }

  try {
    await redis.ping();
  } catch {
    redisOk = false;
  }

  const network = await checkProviderNetwork();

  const status: HealthStatus =
    !databaseOk || !redisOk
      ? "unhealthy"
      : network.ok
        ? "healthy"
        : "degraded";

  return {
    status,
    checks: {
      database: databaseOk ? "ok" : "failed",
      redis: redisOk ? "ok" : "failed",
      rpc: network.ok ? "ok" : "failed",
    },
    network: {
      name: network.networkName,
      chainId: network.chainId,
      expectedChainId: network.expectedChainId,
      expectedChainIdHex: network.expectedChainIdHex,
    },
    error: network.error,
  };
};
