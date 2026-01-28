import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Twitter, Send } from 'lucide-react';
import { useIndexerStatus } from '../../hooks/useIndexerStatus';
import { useChainStatus } from '../../hooks/useChainStatus';
import deployments from '../../config/deployments.json';

export const Footer = () => {
  const { currentChainStatus, isLoading, error } = useIndexerStatus();
  const { rpcBlock, rpcConnected } = useChainStatus();
  const [showStatusHelp, setShowStatusHelp] = useState(false);

  const syncLag = rpcBlock && currentChainStatus
    ? rpcBlock - currentChainStatus.block.number
    : null;

  const isSynced = syncLag !== null && syncLag < 10;

  return (
    <footer className="border-t border-slate-800/50 bg-slate-950/50 py-8 mt-auto">
      <div className="container mx-auto max-w-7xl px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-sm">
        <div className="flex items-center gap-4">
          <img src="/sooth-logo.svg" alt="Sooth" className="w-6 h-6 opacity-50" />
          <span className="font-mono text-slate-500">© 2026 Sooth Protocol | {deployments.version}</span>

          {!isLoading && (
            <div className="flex items-center gap-3">
              <div
                className="flex items-center gap-1.5"
                title={rpcConnected ? "Direct RPC connection active" : "RPC disconnected"}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${rpcConnected ? 'bg-blue-500' : 'bg-gray-500'
                  }`} />
                <span className="font-mono text-xs text-slate-600">
                  RPC
                </span>
              </div>

              <div className="w-px h-3 bg-slate-700" />

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
                  ? 'bg-red-500'
                  : isSynced
                    ? 'bg-green-500 animate-pulse'
                    : currentChainStatus
                      ? 'bg-yellow-500'
                      : 'bg-gray-500'
                  }`} />
                <span className="font-mono text-xs text-slate-600">
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
                  className="w-4 h-4 rounded-full bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-cyan-400 transition-colors flex items-center justify-center text-xs font-bold"
                  onMouseEnter={() => setShowStatusHelp(true)}
                  onMouseLeave={() => setShowStatusHelp(false)}
                  aria-label="Status indicator help"
                >
                  ?
                </button>

                {showStatusHelp && (
                  <div className="absolute bottom-full right-0 mb-2 w-80 bg-slate-900 border border-slate-700 rounded-lg p-4 shadow-xl z-50">
                    <h4 className="text-sm font-bold text-cyan-400 mb-2">Status Indicators</h4>
                    <div className="space-y-3 text-xs text-slate-300">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                          <span className="font-semibold text-slate-200">Indexer (Green)</span>
                          <span className="text-red-400 font-bold">CRITICAL</span>
                        </div>
                        <p className="text-slate-400 ml-4">
                          Historical data for orderbook, trades, and market history.
                          <br />
                          <span className="text-red-400">Without: No orderbook visible</span>
                        </p>
                      </div>

                      <div className="border-t border-slate-700 pt-2">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                          <span className="font-semibold text-slate-200">RPC (Blue)</span>
                          <span className="text-yellow-400 font-bold">IMPORTANT</span>
                        </div>
                        <p className="text-slate-400 ml-4">
                          Direct blockchain connection for live balances and current state.
                          <br />
                          <span className="text-yellow-400">Without: Stale wallet data</span>
                        </p>
                      </div>

                      <div className="border-t border-slate-700 pt-2">
                        <p className="text-slate-500 italic">
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

        <div className="flex items-center gap-1">
          <a href="https://t.me/soothprotocol" target="_blank" rel="noopener noreferrer" className="hover:text-cyan-400 transition-colors flex items-center p-1" title="Telegram">
            <Send size={18} />
          </a>
          <a href="https://x.com/SoothProtocol" target="_blank" rel="noopener noreferrer" className="hover:text-cyan-400 transition-colors flex items-center p-1" title="X (Twitter)">
            <Twitter size={18} />
          </a>
        </div>
      </div>
    </footer>
  );
};
