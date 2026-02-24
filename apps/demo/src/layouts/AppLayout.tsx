import { Outlet } from 'react-router-dom';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { ActivityListener } from '../components/features/ActivityListener';

import { useChainId, useAccount } from 'wagmi';
import { useChainStore } from '../store/useChainStore';
import { allowedChains } from '../lib/chains';
import { useEffect } from 'react';
import { logger } from '../lib/logger';

export const AppLayout = () => {
  // Sync wallet chain with store
  const { isConnected } = useAccount();
  const walletChainId = useChainId();
  const { selectedChainId, setSelectedChain } = useChainStore();

  useEffect(() => {
    if (isConnected && walletChainId && walletChainId !== selectedChainId) {
      // Only sync if the wallet chain is one of our allowed chains
      const isAllowed = allowedChains.some(c => c.id === walletChainId);
      if (isAllowed) {
        logger.chain.log(`Syncing selected chain to wallet: ${walletChainId}`);
        setSelectedChain(walletChainId);
      }
    }
  }, [isConnected, walletChainId, selectedChainId, setSelectedChain]);

  return (
    <div className="min-h-dvh flex flex-col pb-safe bg-background text-slate-300 font-mono selection:bg-cyan-500/30">
      <Navbar />
      <ActivityListener />

      <main className="flex-1 container mx-auto max-w-7xl px-4 py-8">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
};

