import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { createAppKit } from '@reown/appkit/react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { wagmiAdapter, projectId, metadata, networks } from './lib/wagmi';
// NOTE (alpha): `ActivityListener` currently depends on removed V5 hooks (hooks/v5/*),
// which causes Vite to 404 those module URLs and breaks the app. Re-introduce a V8 version later.

// Pages
import { Landing } from './pages/v8/Landing';
import { AppLayout } from './layouts/AppLayout';
import { Faucet } from './pages/v8/Faucet';

// Role-Based Pages (V8.1)
import { Trade } from './pages/Trade';
import { Create } from './pages/Create';
import { Pro } from './pages/Pro';
import { Portfolio } from './pages/Portfolio';
import { Gov } from './pages/Gov';
import { Learn } from './pages/Learn';

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
  // Allow users to stay on unsupported chains without forcing the network switch modal
  allowUnsupportedChain: true,
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
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
            <Route element={<AppLayout />}>
              <Route path="/about" element={<Learn />} />
              {/* Role-Based Pages (V8.1) */}
              <Route path="/trade" element={<Trade />} />
              <Route path="/trade/:marketId" element={<Trade />} />
              <Route path="/pro" element={<Pro />} />
              <Route path="/pro/:marketId" element={<Pro />} />
              <Route path="/create" element={<Create />} />
              <Route path="/portfolio" element={<Portfolio />} />
              <Route path="/gov" element={<Gov />} />
              <Route path="/faucet" element={<Faucet />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);
