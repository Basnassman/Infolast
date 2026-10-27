/**
 * =====================================================
 * NETWORK CONSTANTS
 * =====================================================
 *
 * Infolast runs on Ethereum Sepolia Testnet ONLY.
 *
 * These constants are intentionally dependency-free so they can be
 * imported from config/env.ts without creating an import cycle
 * (provider.ts → env.ts → constants.ts is safe).
 */

export const SEPOLIA_CHAIN_ID = 11155111;

/** eth_chainId response for Sepolia */
export const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7";

export const SEPOLIA_NAME = "Sepolia Testnet";

/**
 * True when the given chain id is Sepolia.
 */
export const isSepoliaChainId = (chainId: number): boolean =>
  chainId === SEPOLIA_CHAIN_ID;
