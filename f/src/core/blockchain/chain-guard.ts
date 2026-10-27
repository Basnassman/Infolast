import { ConfigurationError } from "@core/errors/infrastructure/configuration.error";
import {
  SEPOLIA_CHAIN_ID,
  SEPOLIA_CHAIN_ID_HEX,
  SEPOLIA_NAME,
} from "./chains/constants";
import { provider } from "./provider";

/**
 * =====================================================
 * CHAIN GUARD
 * =====================================================
 *
 * Verifies that RPC_URL actually points at Ethereum Sepolia.
 *
 * This catches the classic misconfiguration where a mainnet URL or a
 * non-Ethereum endpoint is pasted into RPC_URL: the indexer would then
 * query Sepolia contract addresses on the wrong chain, get zero logs and
 * silently mark blocks as processed.
 */

export interface NetworkCheck {
  ok: boolean;
  chainId: number | null;
  expectedChainId: number;
  expectedChainIdHex: string;
  networkName: string;
  error?: string;
  checkedAt: string;
}

const CACHE_TTL_MS = 60_000;

let cached: { value: NetworkCheck; at: number } | null = null;

/**
 * Check the provider network (cached for 60s).
 */
export const checkProviderNetwork = async (
  force = false
): Promise<NetworkCheck> => {
  if (!force && cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.value;
  }

  let value: NetworkCheck;

  try {
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);

    value = {
      ok: chainId === SEPOLIA_CHAIN_ID,
      chainId,
      expectedChainId: SEPOLIA_CHAIN_ID,
      expectedChainIdHex: SEPOLIA_CHAIN_ID_HEX,
      networkName: SEPOLIA_NAME,
      checkedAt: new Date().toISOString(),
      error:
        chainId === SEPOLIA_CHAIN_ID
          ? undefined
          : `RPC_URL is connected to chainId ${chainId}, expected ${SEPOLIA_CHAIN_ID} (${SEPOLIA_CHAIN_ID_HEX})`,
    };
  } catch (error: any) {
    value = {
      ok: false,
      chainId: null,
      expectedChainId: SEPOLIA_CHAIN_ID,
      expectedChainIdHex: SEPOLIA_CHAIN_ID_HEX,
      networkName: SEPOLIA_NAME,
      checkedAt: new Date().toISOString(),
      error: `RPC_URL unreachable: ${error?.shortMessage ?? error?.message ?? "unknown error"}`,
    };
  }

  cached = { value, at: Date.now() };

  return value;
};

/**
 * Throw when the configured RPC is not Sepolia.
 */
export const assertSepoliaNetwork = async (): Promise<NetworkCheck> => {
  const result = await checkProviderNetwork();

  if (!result.ok) {
    throw new ConfigurationError(
      result.error ??
        `RPC_URL must point to Ethereum Sepolia (${SEPOLIA_CHAIN_ID})`
    );
  }

  return result;
};
