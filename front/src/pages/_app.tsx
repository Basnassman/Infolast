import type { AppProps } from 'next/app';
import { WagmiContextProvider } from '@/contexts/WagmiProvider';
import ClientLayout from '@/components/ClientLayout';
import '@/styles/globals.css';
import '@rainbow-me/rainbowkit/styles.css';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <WagmiContextProvider>
      <ClientLayout>
        <Component {...pageProps} />
      </ClientLayout>
    </WagmiContextProvider>
  );
}
