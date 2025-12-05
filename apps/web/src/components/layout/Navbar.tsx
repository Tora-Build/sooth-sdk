import React, { useEffect } from 'react';
import { useAppKit, useAppKitAccount } from '@reown/appkit/react';
import { useMarketStore } from '../../store/useMarketStore';
import { useNavigationStore } from '../../store/useNavigationStore';
import { cn } from '../../lib/utils';
import { ChainSelector } from '../ui/ChainSelector';

export const Navbar: React.FC = () => {
  const { mode, setMode } = useMarketStore();
  const { currentView, setView } = useNavigationStore();
  const { open } = useAppKit();
  const { address, isConnected, status } = useAppKitAccount();

  // Force mode based on connection status
  useEffect(() => {
    // Prevent flashing during connection initialization
    if (status === 'connecting' || status === 'reconnecting') return;

    if (isConnected) {
      if (mode !== 'real') setMode('real');
    } else {
      if (mode !== 'demo') setMode('demo');
    }
  }, [isConnected, status, mode, setMode]);

  // Format address for display
  const displayAddress = address 
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : '';

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto max-w-7xl h-full px-6 flex items-center justify-between">
        
        {/* Brand */}
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('dapp')}>
            <img src="/sooth-logo.svg" alt="Sooth Protocol" className="w-8 h-8" />
            <div className="hidden sm:block">
              <div className="font-heading font-bold text-lg leading-none tracking-wide text-white">SOOTH</div>
              <div className="text-[10px] font-medium text-slate-500 tracking-[0.2em] uppercase">Protocol</div>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <button 
              onClick={() => setView('dapp')}
              className={cn(
                "transition-colors",
                currentView === 'dapp' ? "text-white" : "text-slate-400 hover:text-white"
              )}
            >
              dApp
            </button>
            <button 
              onClick={() => setView('about')}
              className={cn(
                "transition-colors",
                currentView === 'about' ? "text-white" : "text-slate-400 hover:text-white"
              )}
            >
              About
            </button>
          </nav>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 sm:gap-4">
          
          {/* Mode Toggle */}
          <div className="flex items-center bg-slate-900 rounded-full p-0.5 border border-slate-800">
            <button
              disabled
              className={cn(
                "px-2 py-1 rounded-full text-[10px] font-medium transition-all cursor-default",
                mode === 'real' 
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25" 
                  : "text-slate-700 opacity-50"
              )}
            >
              Test
            </button>
            <button
              disabled
              className={cn(
                "px-2 py-1 rounded-full text-[10px] font-medium transition-all cursor-default",
                mode === 'demo' 
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/25" 
                  : "text-slate-700 opacity-50"
              )}
            >
              Demo
            </button>
          </div>

          {/* Chain Selector (Show when wallet connected) */}
          <ChainSelector />

          {/* Wallet Connect - AppKit */}
          {!isConnected ? (
            <button 
              onClick={() => open()}
              className="btn-primary text-xs sm:text-sm py-1.5 px-3 sm:py-2 sm:px-4 whitespace-nowrap"
            >
              Connect <span className="hidden sm:inline">Wallet</span>
            </button>
          ) : (
            <button 
              onClick={() => open({ view: 'Account' })}
              className="btn-secondary text-xs sm:text-sm py-1.5 px-2 sm:py-2 sm:px-4 flex items-center gap-2 whitespace-nowrap"
            >
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400 animate-pulse" />
              {displayAddress}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
