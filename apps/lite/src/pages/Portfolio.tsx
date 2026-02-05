import { useAccount } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { useNavigate } from 'react-router-dom';
import { PieChart, TrendingUp, Wallet, Loader2 } from 'lucide-react';
import { useUSDCBalance, usePositions, type Position } from '../hooks';

function formatShares(shares: bigint): string {
  const value = Number(shares) / 1e18;
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toFixed(2);
}

function PositionCard({ position, onClick }: { position: Position; onClick: () => void }) {
  const yesPercent = Math.round((position.market.yesProbability ?? 0.5) * 100);

  return (
    <button
      onClick={onClick}
      className="w-full p-4 rounded-2xl glass-panel text-left hover:bg-white/5 transition-colors"
    >
      <p className="text-white font-medium line-clamp-2 mb-3">{position.market.question}</p>
      <div className="flex items-center justify-between">
        <div className="flex gap-4">
          {position.yesShares > 0n && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cyan-400" />
              <span className="text-sm text-cyan-400 font-bold">
                {formatShares(position.yesShares)} YES
              </span>
            </div>
          )}
          {position.noShares > 0n && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-fuchsia-400" />
              <span className="text-sm text-fuchsia-400 font-bold">
                {formatShares(position.noShares)} NO
              </span>
            </div>
          )}
        </div>
        <div className="text-right">
          <p className="text-[10px] text-white/40 uppercase">Value</p>
          <p className="text-sm font-bold text-white">${position.valueUsd.toFixed(2)}</p>
        </div>
      </div>
      <div className="mt-3 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-full"
          style={{ width: `${yesPercent}%` }}
        />
      </div>
    </button>
  );
}

export function Portfolio() {
  const { address, isConnected } = useAccount();
  const { open } = useAppKit();
  const navigate = useNavigate();
  const { balanceFormatted } = useUSDCBalance(address);
  const { data: positions, isLoading: isLoadingPositions } = usePositions();

  const totalPositionValue = positions?.reduce((sum, p) => sum + p.valueUsd, 0) ?? 0;

  if (!isConnected) {
    return (
      <div className="h-full w-full flex flex-col bg-mesh text-slate-100">
        <header className="shrink-0 pt-14 px-6 pb-4">
          <h1 className="text-2xl font-bold font-heading text-white">Vault</h1>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center px-6 pb-32">
          <div className="w-20 h-20 rounded-3xl glass-panel flex items-center justify-center mb-6">
            <Wallet className="w-10 h-10 text-cyan-400" />
          </div>
          <p className="text-white font-bold text-lg mb-2">Connect Your Wallet</p>
          <p className="text-white/40 text-sm text-center mb-6">
            Connect to view your positions and balance
          </p>
          <button
            onClick={() => open()}
            className="px-8 py-4 rounded-2xl bg-cyan-500 text-white font-bold neon-cyan active:scale-95 transition-all"
          >
            Connect Wallet
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col bg-mesh text-slate-100">
      <header className="shrink-0 pt-14 px-6 pb-4">
        <h1 className="text-2xl font-bold font-heading text-white mb-4">Vault</h1>

        <div className="p-6 rounded-3xl glass-panel">
          <p className="text-[11px] text-white/40 uppercase font-bold tracking-widest mb-2">
            Total Balance
          </p>
          <p className="text-4xl font-bold text-white font-mono mb-4">
            ${balanceFormatted || '0.00'}
          </p>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <p className="text-[10px] text-white/40 uppercase">Positions</p>
                <p className="text-sm font-bold text-cyan-400">${totalPositionValue.toFixed(2)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-fuchsia-500/20 flex items-center justify-center">
                <PieChart className="w-4 h-4 text-fuchsia-400" />
              </div>
              <div>
                <p className="text-[10px] text-white/40 uppercase">Markets</p>
                <p className="text-sm font-bold text-fuchsia-400">{positions?.length ?? 0}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 pb-32">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[11px] text-white/40 uppercase font-bold tracking-widest">
            Your Positions
          </p>
          {positions && positions.length > 0 && (
            <p className="text-sm text-white/60">{positions.length} active</p>
          )}
        </div>

        {isLoadingPositions ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-4" />
            <p className="text-white/40">Loading positions...</p>
          </div>
        ) : positions && positions.length > 0 ? (
          <div className="space-y-3">
            {positions.map((position) => (
              <PositionCard
                key={position.market.address}
                position={position}
                onClick={() => navigate(`/trade/${position.market.address}`)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-2xl glass-panel flex items-center justify-center mb-4">
              <PieChart className="w-8 h-8 text-white/20" />
            </div>
            <p className="text-white/40 text-center">No positions yet</p>
            <p className="text-white/30 text-sm text-center mt-1">
              Start trading to see your positions here
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
