import { useState } from 'react';
import { useIndexerStatus } from '../hooks/useIndexerStatus';
import { useChainStatus } from '../hooks/useChainStatus';

export const Footer = () => {
  const { currentChainStatus, isLoading, error } = useIndexerStatus();
  const { rpcBlock, rpcConnected } = useChainStatus();
  const [showStatusHelp, setShowStatusHelp] = useState(false);

  const syncLag = rpcBlock && currentChainStatus
    ? rpcBlock - currentChainStatus.block.number
    : null;

  const isSynced = syncLag !== null && syncLag < 10;

  return (
    <footer className="border-t border-white/[0.04] bg-zinc-950/50 py-8 mt-12 text-sm text-zinc-500 font-mono">
      <div className="container mx-auto max-w-7xl px-6 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-4">
          <span className="text-zinc-500 tracking-tight uppercase">© 2026 Sooth Protocol | V12</span>

          {!isLoading && (
            <div className="flex items-center gap-3">
              <div
                className="flex items-center gap-1.5"
                title={rpcConnected ? "Direct RPC connection active" : "RPC disconnected"}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${rpcConnected ? 'bg-blue-500' : 'bg-zinc-600'
                  }`} />
                <span className="text-xs text-zinc-400">
                  RPC
                </span>
              </div>

              <div className="w-px h-3 bg-white/[0.06]" />

              <div
                className="flex items-center gap-1.5"
                title={
                  error
                    ? 'Ponder indexer is offline'
                    : isSynced
                      ? 'Indexer is synced with chain'
                      : syncLag && syncLag > 0
                        ? `Indexer is ${syncLag} blocks behind`
                        : 'Indexer status unknown'
                }
              >
                <div className={`w-2 h-2 rounded-full ${error
                  ? 'bg-rose-500'
                  : isSynced
                    ? 'bg-emerald-500 animate-pulse'
                    : currentChainStatus
                      ? 'bg-amber-500'
                      : 'bg-zinc-600'
                  }`} />
                <span className="text-xs text-zinc-400">
                  {error
                    ? 'Indexer offline'
                    : currentChainStatus
                      ? isSynced
                        ? `Block ${currentChainStatus.block.number.toLocaleString()}`
                        : syncLag && syncLag > 0
                          ? `Block ${currentChainStatus.block.number.toLocaleString()} (-${syncLag})`
                          : `Block ${currentChainStatus.block.number.toLocaleString()}`
                      : 'Not indexed'}
                </span>
              </div>

              <div className="relative">
                <button
                  className="w-4 h-4 rounded-full bg-zinc-900 border border-white/[0.06] text-zinc-400 hover:bg-zinc-800 hover:text-amber-400 transition-colors flex items-center justify-center text-[10px] font-bold"
                  onMouseEnter={() => setShowStatusHelp(true)}
                  onMouseLeave={() => setShowStatusHelp(false)}
                  aria-label="Status indicator help"
                >
                  ?
                </button>

                {showStatusHelp && (
                  <div className="absolute bottom-full right-0 mb-2 w-80 bg-zinc-900 border border-white/[0.06] rounded-xl p-4 shadow-xl shadow-black/50 z-50">
                    <h4 className="text-sm font-bold text-amber-400 mb-2 font-sans tracking-tight">Status Indicators</h4>
                    <div className="space-y-3 text-xs text-zinc-300 font-sans">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                          <span className="font-semibold text-zinc-200">Indexer (Green)</span>
                          <span className="text-rose-400 font-mono text-[10px] uppercase tracking-wider font-bold">Critical</span>
                        </div>
                        <p className="text-zinc-400 ml-4 leading-relaxed">
                          Historical data for orderbook, trades, and market history.
                          <br />
                          <span className="text-rose-400">Without: No orderbook visible</span>
                        </p>
                      </div>

                      <div className="border-t border-white/[0.04] pt-2">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                          <span className="font-semibold text-zinc-200">RPC (Blue)</span>
                          <span className="text-amber-400 font-mono text-[10px] uppercase tracking-wider font-bold">Important</span>
                        </div>
                        <p className="text-zinc-400 ml-4 leading-relaxed">
                          Direct blockchain connection for live balances and current state.
                          <br />
                          <span className="text-amber-400">Without: Stale wallet data</span>
                        </p>
                      </div>

                      <div className="border-t border-white/[0.04] pt-2">
                        <p className="text-zinc-500 italic text-[11px]">
                          Colors: 🟢 Synced | 🟡 Lagging | 🔴 Offline
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <a href="https://t.me/soothprotocol" target="_blank" rel="noopener noreferrer" className="hover:text-amber-400 transition-colors flex items-center p-1" title="Telegram">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </a>
          <a href="https://x.com/SoothProtocol" target="_blank" rel="noopener noreferrer" className="hover:text-amber-400 transition-colors flex items-center p-1" title="X (Twitter)">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4l11.733 16h4.267l-11.733 -16z"></path>
              <path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772"></path>
            </svg>
          </a>
        </div>
      </div>
    </footer>
  );
};
