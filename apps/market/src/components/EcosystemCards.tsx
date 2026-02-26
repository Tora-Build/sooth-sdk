import React from 'react';
import { getNodeByChainId } from '@sooth/registry';

function NodeIdChip({ nodeId }: { nodeId?: string }) {
  if (!nodeId) return <span className="font-mono text-[10px] text-zinc-600">—</span>;
  return (
    <span className="font-mono text-[10px] px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded">
      {nodeId}
    </span>
  );
}

export function EcosystemCards() {
  const demoNode = getNodeByChainId(84532);
  const moltbookNode = getNodeByChainId(10143);
  const lensNode = getNodeByChainId(37111);

  return (
    <div>
      <p className="text-zinc-500 font-mono text-xs uppercase tracking-widest px-2 mb-6">
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
            <div className="flex items-center gap-2">
              <NodeIdChip nodeId={demoNode?.id} />
            </div>
            <span className="text-zinc-400 font-mono text-xs">Base Sepolia</span>
            <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider">
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
            <div className="flex items-center gap-2">
              <NodeIdChip nodeId={moltbookNode?.id} />
            </div>
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
          className="group bg-zinc-900/50 border border-zinc-800/50 backdrop-blur rounded-xl p-5 block hover:border-zinc-700/70 transition-all"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <NodeIdChip nodeId={lensNode?.id} />
            </div>
            <span className="text-zinc-400 font-mono text-xs">Lens Testnet</span>
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider">
              Live
            </span>
          </div>
          <h3 className="text-zinc-100 font-bold mb-1">Sooth Lens</h3>
          <p className="text-zinc-400 text-sm">Social prediction markets on Lens Protocol</p>
        </a>
      </div>
    </div>
  );
}
