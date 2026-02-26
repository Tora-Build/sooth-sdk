import { useIndexerStatus } from '../hooks/useIndexerStatus';

const CHAIN_LABELS: Record<string, string> = {
  baseSepolia: 'Base',
  monadTestnet: 'Monad',
  arcTestnet: 'Arc',
};

export const Footer = () => {
  const { status, isLoading, error } = useIndexerStatus();

  return (
    <footer className="border-t border-white/[0.04] bg-zinc-950/50 py-8 text-sm text-zinc-500 font-mono">
      <div className="max-w-[1400px] mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-4">
          <span className="text-zinc-500 tracking-tight uppercase">© 2026 Sooth Protocol</span>

          {!isLoading && (
            <div className="flex items-center gap-3">
              {error ? (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-rose-500" />
                  <span className="text-xs text-zinc-400">Indexer offline</span>
                </div>
              ) : status ? (
                Object.entries(status).map(([key, chain]) => {
                  const label = CHAIN_LABELS[key] ?? key;
                  return (
                    <div
                      key={key}
                      className="flex items-center gap-1.5"
                      title={`${label}: Block ${chain.block.number.toLocaleString()}`}
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className="text-xs text-zinc-500">
                        {label} #{chain.block.number.toLocaleString()}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                  <span className="text-xs text-zinc-400">Not indexed</span>
                </div>
              )}
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
