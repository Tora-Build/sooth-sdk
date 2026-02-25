import { useIndexerStatus } from '../hooks/useIndexerStatus';
import { useChainStatus } from '../hooks/useChainStatus';

export const CardFooter = () => {
  const { currentChainStatus, isLoading, error } = useIndexerStatus();
  const { rpcBlock, rpcConnected } = useChainStatus();

  const syncLag = rpcBlock && currentChainStatus
    ? rpcBlock - currentChainStatus.block.number
    : null;

  const isSynced = syncLag !== null && syncLag < 10;

  const dotColor = error
    ? 'bg-rose-500'
    : isSynced && rpcConnected
      ? 'bg-emerald-500 animate-pulse'
      : currentChainStatus || rpcConnected
        ? 'bg-amber-500'
        : 'bg-zinc-700';

  const dotTitle = error
    ? 'Indexer offline'
    : isSynced && rpcConnected
      ? 'All systems operational'
      : 'Degraded — check footer for details';

  return (
    <div className="border-t border-white/[0.04] px-6 py-3 flex items-center gap-3 bg-zinc-900/20">
      <span className="font-mono text-[11px] text-zinc-600 uppercase tracking-widest">V12.0</span>
      {!isLoading && (
        <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`} title={dotTitle} />
      )}
    </div>
  );
};
