import { sepolia, mainnet } from 'wagmi/chains';

export type NetworkType = 'sepolia' | 'mainnet';

// ─── RPC من .env ─────────────────────────────────────────────────────────
const SEPOLIA_RPC = process.env.NEXT_PUBLIC_SEPOLIA_RPC || 'https://ethereum-sepolia.core.chainstack.com/892a28be8ff030c1544ff6eaf9c6ef0f';
const MAINNET_RPC = process.env.NEXT_PUBLIC_MAINNET_RPC || 'https://eth.llamarpc.com';

export const NETWORKS = {
  sepolia: {
    chain: sepolia,
    name: 'Sepolia Testnet',
    rpc: SEPOLIA_RPC,
    explorer: 'https://sepolia.etherscan.io',
  },
  mainnet: {
    chain: mainnet,
    name: 'Ethereum Mainnet',
    rpc: MAINNET_RPC,
    explorer: 'https://etherscan.io',
  },
} as const;

export const ACTIVE_NETWORK: NetworkType = 
  (process.env.NEXT_PUBLIC_NETWORK as NetworkType) || 'sepolia';

export const CURRENT_CONTRACTS = {
  sepolia: {
    TOKEN: '0x32e64b5f40139f36D46dfbEa20Ef7A7C1EA76721',
    SALE: '0x864C2350945bd4E9F7097F76CED2B10fD0cD2D99',
    AIRDROP: '0x10C50DC51d14089D80866803A15Dce112B17f799',
    VESTING: '0x8597F2723335E61Cd1CC1C21c962Ff393685Ca98',
    PRICE_ORACLE: '0x13425A5F4A68eC0D660EC4Ea5E21d42BA8e686Db',
    USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    USDT: '0xAA0E2d147E6A4fEbcEbCedE87a5D3A6e6f3D6f3C',
    DAI: '0x3e622317f8C93f7328350cF0B8d9C6e5E1E6B5B5',
    WETH: '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9',
  },
  mainnet: {
    TOKEN: '0x62Aa8E8b8E8b060a5C0279a70E3534e2Bc19aF10',
    SALE: '0xYOUR_MAINNET_SALE',
    AIRDROP: '0x3F79C228ff97B0491D9d8cbdA071df4a80338430',
    VESTING: '0x01260f7537E7E66cC33567C837F33e5D1DC7beb1',
    PRICE_ORACLE: '0xYOUR_MAINNET_ORACLE',
    USDC: '0xA0b86a33E6441e0A421e56E4773C3C4b0Db7E5f0',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  },
}[ACTIVE_NETWORK];