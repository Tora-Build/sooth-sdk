import React from 'react';
import ReactDOM from 'react-dom/client';
import { createAppKit } from '@reown/appkit/react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiAdapter, projectId, metadata, networks } from './lib/wagmi';
import App from './App';
import './index.css';

const queryClient = new QueryClient();

// Create AppKit modal with EVM only
createAppKit({
  adapters: [wagmiAdapter],
  networks: networks,
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
    '--w3m-font-family': 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  // Exclude Phantom wallet to prevent interference with MetaMask
  excludeWalletIds: [
    '225affb176778569276e484e1b92637ad061b01e13a048b35a9d280c3b58970f', // Phantom
  ],
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);
