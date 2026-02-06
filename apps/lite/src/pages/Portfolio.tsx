import { useAccount } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { useNavigate } from 'react-router-dom';
import { PieChart, TrendingUp, Wallet, Loader2 } from 'lucide-react';
import { useUSDCBalance, usePositions, type Position } from '../hooks';
import { parseTextWithLinks } from '../lib/utils';

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
      className="w-full p-4 rounded-2xl glass-panel text-left hover:bg-[#444] transition-colors border border-[#444]"
    >
      <div className="text-white font-normal line-clamp-2 mb-3">{parseTextWithLinks(position.market.question)}</div>
       <div className="flex items-center justify-between">
         <div className="flex gap-4">
           {position.yesShares > 0n && (
             <div className="flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-[#00d4aa]" />
               <span className="text-sm text-[#00d4aa] font-bold">
                 {formatShares(position.yesShares)} YES
               </span>
             </div>
           )}
           {position.noShares > 0n && (
             <div className="flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-[#e01b24]" />
               <span className="text-sm text-[#e01b24] font-bold">
                 {formatShares(position.noShares)} NO
               </span>
             </div>
           )}
           {position.lpBalance > 0n && (
             <div className="flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-[#ffd700]" />
               <span className="text-sm text-[#ffd700] font-bold">
                 {formatShares(position.lpBalance)} LP
               </span>
             </div>
           )}
         </div>
        <div className="text-right">
          <p className="text-[10px] text-[#888] uppercase">Value</p>
          <p className="text-sm font-bold text-white">${position.valueUsd.toFixed(2)}</p>
        </div>
      </div>
      <div className="mt-3 h-1.5 w-full bg-[#2d2d2e] rounded-full overflow-hidden border border-[#444]">
        <div
          className="h-full bg-gradient-to-r from-[#00d4aa] to-[#00b894] rounded-full"
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
      <div className="h-full w-full flex flex-col bg-mesh text-white">
        <header className="shrink-0 pt-4 px-6 pb-4">
          <h1 className="text-2xl font-bold font-heading text-white">Portfolio</h1>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center px-6 pb-32">
          <div className="w-20 h-20 rounded-xl glass-panel flex items-center justify-center mb-6 border border-[#444]">
            <Wallet className="w-10 h-10 text-[#00d4aa]" />
          </div>
          <p className="text-white font-bold text-lg mb-2">Connect Your Wallet</p>
          <p className="text-[#888] text-sm text-center mb-6">
            Connect to view your positions and balance
          </p>
          <button
            onClick={() => open()}
            className="px-8 py-4 rounded-xl bg-gradient-to-r from-[#00d4aa] to-[#00b894] text-[#1a1a1b] font-bold neon-teal active:scale-95 transition-all"
          >
            Connect Wallet
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col bg-mesh text-white">
      <header className="shrink-0 pt-4 px-6 pb-4">
        <h1 className="text-2xl font-bold font-heading text-white mb-4">Portfolio</h1>

        <div className="rounded-2xl glass-panel overflow-hidden border border-[#444]">
          <div className="bg-[#1a1a1b] px-4 py-2 border-b border-[#444]">
            <p className="text-[11px] text-[#888] uppercase font-bold tracking-widest">
              Total Balance
            </p>
          </div>
          <div className="p-4">
            <p className="text-4xl font-bold text-[#00d4aa] font-mono mb-4">
              ${balanceFormatted || '0.00'}
            </p>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#00d4aa]/20 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-[#00d4aa]" />
                </div>
                <div>
                  <p className="text-[10px] text-[#888] uppercase">Positions</p>
                  <p className="text-sm font-bold text-[#00d4aa]">${totalPositionValue.toFixed(2)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#e01b24]/20 flex items-center justify-center">
                  <PieChart className="w-4 h-4 text-[#e01b24]" />
                </div>
                <div>
                  <p className="text-[10px] text-[#888] uppercase">Markets</p>
                  <p className="text-sm font-bold text-[#e01b24]">{positions?.length ?? 0}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 pb-32">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[11px] text-[#888] uppercase font-bold tracking-widest">
            Your Positions
          </p>
          {positions && positions.length > 0 && (
            <p className="text-sm text-[#888]">{positions.length} active</p>
          )}
        </div>

        {isLoadingPositions ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-[#00d4aa] animate-spin mb-4" />
            <p className="text-[#888]">Loading positions...</p>
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
            <div className="w-16 h-16 rounded-xl glass-panel flex items-center justify-center mb-4 border border-[#444]">
              <PieChart className="w-8 h-8 text-[#444]" />
            </div>
            <p className="text-[#888] text-center">No positions yet</p>
            <p className="text-[#555] text-sm text-center mt-1">
              Start trading to see your positions here
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
