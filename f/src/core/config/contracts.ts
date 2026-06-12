import { env } from "./env";

export const contracts = {
  sepolia: {
    chainId:    env.chainId,
    name:       "Sepolia",
    rpc:        env.rpcUrl,
    airdrop:    env.contracts.airdrop,
    token:      env.contracts.token,
    vesting:    env.contracts.vesting,
    priceOracle: env.contracts.priceOracle,
    sale:       env.contracts.sale,
  },
} as const;

export type ChainKey = keyof typeof contracts;
export const DEFAULT_CHAIN: ChainKey = "sepolia";