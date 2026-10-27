import { sepolia, mainnet } from 'wagmi/chains';

export type NetworkType = 'sepolia' | 'mainnet';

// ─── RPC من .env ─────────────────────────────────────────────────────────
// IMPORTANT: never hardcode a provider key here — NEXT_PUBLIC_* values are
// shipped to the browser. Fall back to the public Sepolia RPC when unset.
const SEPOLIA_RPC = process.env.NEXT_PUBLIC_SEPOLIA_RPC || sepolia.rpcUrls.default.http[0];
const MAINNET_RPC = process.env.NEXT_PUBLIC_MAINNET_RPC || 'https://eth.llamarpc.com';

/**
 * The only chain Infolast supports.
 * Used to block writes when a wallet is connected to another network.
 */
export const SEPOLIA_CHAIN_ID = sepolia.id; // 11155111

export const isSepoliaChain = (chainId?: number | null): boolean =>
  chainId === sepolia.id;

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
    TOKEN: '0xfFD230D537d5C3EC22cEFb7F0C3a50fAde919f13',
    SALE: '0xF6629F2f1C844318aE181b3A79bAD2380967E1be',
    AIRDROP: '0x445B458bdA0Fd4a9CF035a83aD8DC55e49F79347',
    VESTING: '0x55a4471d3ADAdAf6EeAa0Ea63153337653193eaC',
    PRICE_ORACLE: '0xB3F5f8734B56231D3555c2d06D73D1F47f2F9bba',
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