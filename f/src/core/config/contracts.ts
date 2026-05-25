export const contracts = {
  sepolia: {
    chainId: 11155111,
    name: "Sepolia",
    rpc: process.env.SEPOLIA_RPC || "https://ethereum-sepolia.core.chainstack.com/892a28be8ff030c1544ff6eaf9c6ef0f",
    token: process.env.TOKEN_ADDRESS || "0x75dABB2A0CE5919a0BD6764d67e320d3Dc11b74E",
    airdrop: process.env.AIRDROP_ADDRESS || "0xdF21eD6190dd47848FE8C5d97112e7302CA8F3B0",
    vesting: process.env.VESTING_ADDRESS || "0xd147EC22Ef57aF0B57e684cdD6237a529fe2F9AD",
    priceOracle: process.env.PRICE_ORACLE_ADDRESS || "0x2c0D06d73fAdB02E1c38a1a3e8159d8b34De6A00",
    sale: process.env.SALE_ADDRESS || "0x9427A42445fF06EF4F25285CEA7212e928c8FA13",
  },
} as const;

export type ChainKey = keyof typeof contracts;
export const DEFAULT_CHAIN: ChainKey = "sepolia";
