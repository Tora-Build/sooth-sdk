import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { createAppKit } from '@reown/appkit/react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { wagmiAdapter, projectId, metadata, networks } from './lib/wagmi';
import { ActivityListener } from './components/features/ActivityListener';

// Pages
import { Landing } from './pages/Landing';
import { About } from './pages/About';
import { AppLayout } from './layouts/AppLayout';
import { Markets } from './pages/Markets';
import { MarketDetail } from './pages/MarketDetail';
import { Portfolio } from './pages/Portfolio';
import { CreateMarket } from './pages/CreateMarket';
import { Faucet } from './pages/Faucet';

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
    '--w3m-accent': '#06b6d4', // Cyan-500 for Neon Terminal theme
    '--w3m-font-family': 'JetBrains Mono, monospace',
  },
  excludeWalletIds: [
    '225affb176778569276e484e1b92637ad061b01e13a048b35a9d280c3b58970f', // Phantom
  ],
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ActivityListener />
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: '#0f172a',
                color: '#e2e8f0',
                border: '1px solid #1e293b',
                fontFamily: 'JetBrains Mono, monospace',
              },
            }}
          />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/about" element={<About />} />
            <Route element={<AppLayout />}>
              <Route path="/markets" element={<Markets />} />
              <Route path="/market/:address" element={<MarketDetail />} />
              <Route path="/portfolio" element={<Portfolio />} />
              <Route path="/create" element={<CreateMarket />} />
              <Route path="/faucet" element={<Faucet />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);
