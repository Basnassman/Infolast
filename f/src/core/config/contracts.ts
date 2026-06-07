export const contracts = {
  sepolia: {
    chainId: 11155111,
    name: "Sepolia",
    rpc: process.env.SEPOLIA_RPC || "https://ethereum-sepolia.core.chainstack.com/892a28be8ff030c1544ff6eaf9c6ef0f",
    token: process.env.TOKEN_ADDRESS || "0x32e64b5f40139f36D46dfbEa20Ef7A7C1EA76721",
    airdrop: process.env.AIRDROP_ADDRESS || "0x10C50DC51d14089D80866803A15Dce112B17f799",
    vesting: process.env.VESTING_ADDRESS || "0x8597F2723335E61Cd1CC1C21c962Ff393685Ca98",
    priceOracle: process.env.PRICE_ORACLE_ADDRESS || "0x13425A5F4A68eC0D660EC4Ea5E21d42BA8e686Db",
    sale: process.env.SALE_ADDRESS || "0x864C2350945bd4E9F7097F76CED2B10fD0cD2D99",
  },
} as const;

export type ChainKey = keyof typeof contracts;
export const DEFAULT_CHAIN: ChainKey = "sepolia";
