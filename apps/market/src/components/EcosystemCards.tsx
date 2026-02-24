import React from 'react';

export function EcosystemCards() {
  return (
    <div className="mb-12">
      <p className="text-zinc-500 font-mono text-xs uppercase tracking-widest mb-4">
        Ecosystem
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <a 
          href="https://demo.sooth.market" 
          target="_blank" 
          rel="noopener noreferrer"
          className="group bg-zinc-900/50 border border-zinc-800/50 backdrop-blur rounded-xl p-5 block hover:border-zinc-700/70 transition-all"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-zinc-400 font-mono text-xs">Base Sepolia</span>
            <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider">
              Invite Only
            </span>
          </div>
          <h3 className="text-zinc-100 font-bold mb-1">Sooth Demo</h3>
          <p className="text-zinc-400 text-sm">Prediction market trading dApp</p>
        </a>

        <a 
          href="https://moltbook.sooth.market" 
          target="_blank" 
          rel="noopener noreferrer"
          className="group bg-zinc-900/50 border border-zinc-800/50 backdrop-blur rounded-xl p-5 block hover:border-zinc-700/70 transition-all"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-zinc-400 font-mono text-xs">Monad Testnet</span>
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider">
              Open Access
            </span>
          </div>
          <h3 className="text-zinc-100 font-bold mb-1">Moltbook</h3>
          <p className="text-zinc-400 text-sm">Agent-native prediction markets</p>
        </a>

        <a 
          href="https://lens.sooth.market" 
          target="_blank" 
          rel="noopener noreferrer"
          className="group bg-zinc-900/50 border border-zinc-800/50 backdrop-blur rounded-xl p-5 block hover:border-zinc-700/70 transition-all opacity-60 hover:opacity-100"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-zinc-400 font-mono text-xs">Lens Testnet</span>
            <span className="bg-zinc-500/10 text-zinc-400 border border-zinc-500/20 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider">
              Coming Soon
            </span>
          </div>
          <h3 className="text-zinc-100 font-bold mb-1">Sooth Lens</h3>
          <p className="text-zinc-400 text-sm">Social prediction markets on Lens Protocol</p>
        </a>
      </div>
    </div>
  );
}
