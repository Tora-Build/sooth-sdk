import React from 'react';
import ReactDOM from 'react-dom/client';
import { createAppKit } from '@reown/appkit/react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { wagmiAdapter, projectId, metadata, networks } from './lib/wagmi';
import { SolanaAdapter } from '@reown/appkit-adapter-solana/react';
import { solanaDevnet } from '@reown/appkit/networks';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import App from './App';
import './index.css';

const queryClient = new QueryClient();

// Create Solana adapter with wallet adapters
const solanaAdapter = new SolanaAdapter({
  wallets: [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
});

// Create AppKit modal with EVM + Solana
createAppKit({
  adapters: [wagmiAdapter, solanaAdapter],
  networks: [...networks, solanaDevnet],
  projectId,
  metadata,
  features: {
    analytics: true,
    email: true,
    socials: ['google', 'github', 'discord'],
  },
  themeMode: 'dark',
  themeVariables: {
    '--w3m-accent': '#4f46e5', // Indigo-600
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <App />
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#0f172a',
              color: '#fff',
              border: '1px solid #1e293b',
            },
          }}
        />
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);
