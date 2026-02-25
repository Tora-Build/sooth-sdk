import { useIndexerStatus } from '../hooks/useIndexerStatus';
import { useChainStatus } from '../hooks/useChainStatus';

export const CardFooter = () => {
  const { currentChainStatus, isLoading, error } = useIndexerStatus();
  const { rpcBlock, rpcConnected } = useChainStatus();

  const syncLag = rpcBlock && currentChainStatus
    ? rpcBlock - currentChainStatus.block.number
    : null;

  const isSynced = syncLag !== null && syncLag < 10;

  return (
    <div className="border-t border-white/[0.04] px-6 py-3 flex items-center justify-between gap-4 bg-zinc-900/20">
      <div className="flex items-center gap-4">
        <span className="font-mono text-[11px] text-zinc-600 uppercase tracking-widest">
          V12.0
        </span>

        {!isLoading && (
          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-1.5"
              title={rpcConnected ? "Direct RPC connection active" : "RPC disconnected"}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${rpcConnected ? 'bg-blue-500' : 'bg-zinc-700'}`} />
              <span className="text-zinc-600 text-[11px] font-mono">
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
              <div className={`w-1.5 h-1.5 rounded-full ${error
                ? 'bg-rose-500'
                : isSynced
                  ? 'bg-emerald-500 animate-pulse'
                  : currentChainStatus
                    ? 'bg-amber-500'
                    : 'bg-zinc-700'
                }`} />
              <span className="text-zinc-600 text-[11px] font-mono">
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
          </div>
        )}
      </div>
    </div>
  );
};
