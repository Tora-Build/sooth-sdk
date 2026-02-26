import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { WalletButton } from './WalletButton';

export function Navbar() {
  const location = useLocation();

  return (
    <header className="border-b border-white/5 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-[1400px] mx-auto px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-8">
        <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-12">
          <Link to="/" className="flex items-center gap-4 group">
            <div className="w-8 h-8 flex items-center justify-center bg-zinc-900 border border-white/10 rounded-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] group-hover:bg-zinc-800 transition-colors">
              <div className="w-3 h-3 bg-amber-500 rounded-sm shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
            </div>
            <div>
              <h1 className="font-bold text-xl tracking-tight text-zinc-50 leading-none font-mono group-hover:text-amber-400 transition-colors">
                SOOTH<span className="text-zinc-500 group-hover:text-amber-400/50">.MARKET</span>
              </h1>
              <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mt-1">
                Sooth Markets Aggregator and Nodes Registry
              </div>
            </div>
          </Link>

          <nav className="flex items-center gap-6 font-mono text-xs uppercase tracking-wider">
            <Link 
              to="/" 
              className={`transition-colors ${location.pathname === '/' ? 'text-amber-400' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Markets
            </Link>
            <Link 
              to="/nodes" 
              className={`transition-colors ${location.pathname === '/nodes' ? 'text-amber-400' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Nodes
            </Link>
          </nav>
        </div>
        
        <div className="flex flex-wrap items-center gap-6 self-start md:self-auto">
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
