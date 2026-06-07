export const contracts = {
  sepolia: {
    chainId: 11155111,
    name: "Sepolia",
    rpc: process.env.SEPOLIA_RPC,
    token: process.env.TOKEN_ADDRESS,
    airdrop: process.env.AIRDROP_ADDRESS,
    vesting: process.env.VESTING_ADDRESS,
    priceOracle: process.env.PRICE_ORACLE_ADDRESS,
    sale: process.env.SALE_ADDRESS,
  },
} as const;

export type ChainKey = keyof typeof contracts;
export const DEFAULT_CHAIN: ChainKey = "sepolia";
