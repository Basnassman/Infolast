'use client';

import { ReactNode } from 'react';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, getDefaultConfig, darkTheme } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';
import { NETWORKS } from '@/config/contracts';

const PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'c594cdcefb23dea78b9f2d92433cc330';

const config = getDefaultConfig({
  appName: 'FOR Token Sale',
  projectId: PROJECT_ID,
  // Infolast is a Sepolia-Testnet-only project: no mainnet transport is
  // configured, so the wallet cannot silently transact on mainnet.
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(NETWORKS.sepolia.rpc),
  },
  ssr: true,
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export function WagmiContextProvider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme()}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
