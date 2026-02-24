import { useMemo } from 'react';
import { useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import { Card } from '../components/ui/Card';
import { useActivePositions, useLPPositions } from '../hooks';
import { TradingAccountCard } from '../components/features/portfolio/TradingAccountCard';
import { ActiveOrdersCard } from '../components/features/portfolio/ActiveOrdersCard';

const formatUsd = (value: number) => {
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatBigint = (value: bigint, decimals: number, digits = 4) => {
  return Number(formatUnits(value, decimals)).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
};

export const Portfolio = () => {
  const { isConnected } = useAccount();
  const {
    vaultPositions: activePositions = [],
    totalPositionValue = 0,
    isLoading: loadingPositions,
  } = useActivePositions();
  const {
    positions: lpPositions = [],
    totalLPValue = 0n,
    isLoading: loadingLp,
  } = useLPPositions();

  const totalLPValueNumber = useMemo(() => Number(formatUnits(totalLPValue, 6)), [totalLPValue]);
  const totalPortfolioValue = totalPositionValue + totalLPValueNumber;

  if (!isConnected) {
    return (
      <Card className="p-8 text-center bg-slate-900/60 border-slate-800">
        <h2 className="text-lg font-semibold text-white mb-2 text-balance">Connect Wallet</h2>
        <p className="text-sm text-slate-400 text-pretty">
          Connect your wallet to view your AMM and LP portfolio positions.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-slate-900/60 border border-slate-800 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white text-balance">Portfolio Overview</h2>
            <p className="text-sm text-slate-400 mt-1 text-pretty">Combined wallet position value and LP exposure.</p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-xs uppercase tracking-wide text-slate-400">Total Value</p>
            <p className="text-2xl font-mono font-semibold text-cyan-400">{formatUsd(totalPortfolioValue)}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-xs text-slate-400">Active Position Value</p>
            <p className="mt-1 text-base font-mono font-semibold text-white">{formatUsd(totalPositionValue)}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-xs text-slate-400">LP Floor Value</p>
            <p className="mt-1 text-base font-mono font-semibold text-white">{formatUsd(totalLPValueNumber)}</p>
          </div>
          <div className="rounded-xl border border-cyan-500/10 bg-slate-950 p-4">
            <p className="text-xs text-slate-400">Open Markets</p>
            <p className="mt-1 text-base font-mono font-semibold text-cyan-400">{activePositions.length + lpPositions.length}</p>
          </div>
        </div>
      </Card>

      <TradingAccountCard />

      <Card className="bg-slate-900/60 border border-slate-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white">Active Positions</h3>
          <span className="text-xs font-mono text-slate-400">
            {loadingPositions ? 'Loading...' : `${activePositions.length} markets`}
          </span>
        </div>

        {loadingPositions ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400">
            Loading active wallet positions...
          </div>
        ) : activePositions.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400">
            No active AMM positions yet.
          </div>
        ) : (
          <div className="space-y-3">
            {activePositions.map((position) => {
              const totalShares = position.walletYes + position.walletNo;
              return (
                <div
                  key={position.id}
                  className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white text-pretty">{position.question}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {position.isSettled ? 'Settled' : 'Live'} market
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-xs text-slate-400">Estimated Value</p>
                      <p className="text-sm font-mono font-semibold text-cyan-400">{formatUsd(position.value)}</p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                      <p className="text-xs text-slate-400">YES Shares</p>
                      <p className="mt-1 font-mono text-white">{position.walletYes.toFixed(4)}</p>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                      <p className="text-xs text-slate-400">NO Shares</p>
                      <p className="mt-1 font-mono text-white">{position.walletNo.toFixed(4)}</p>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-slate-400 font-mono tabular-nums">
                    Total Shares: {totalShares.toFixed(4)} | YES Price: {(position.priceYes * 100).toFixed(1)}%
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <ActiveOrdersCard />

      <Card className="bg-slate-900/60 border border-slate-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white">LP Positions</h3>
          <span className="text-xs font-mono text-slate-400">
            {loadingLp ? 'Loading...' : `${lpPositions.length} markets`}
          </span>
        </div>

        {loadingLp ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400">
            Loading LP positions...
          </div>
        ) : lpPositions.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400">
            No LP positions yet.
          </div>
        ) : (
          <div className="space-y-3">
            {lpPositions.map((position) => (
              <div
                key={position.marketAddress}
                className="rounded-xl border border-slate-800 bg-slate-950 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white text-pretty">{position.marketName}</p>
                    <p className="text-xs text-slate-400 mt-1">{position.isLive ? 'Live LP position' : 'Pre-live LP position'}</p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-xs text-slate-400">Share of Pool</p>
                    <p className="text-sm font-mono font-semibold text-cyan-400">{position.sharePercent.toFixed(2)}%</p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3 text-sm">
                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                    <p className="text-xs text-slate-400">LP Balance</p>
                    <p className="mt-1 font-mono text-white">{formatBigint(position.lpBalance, 18, 4)}</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                    <p className="text-xs text-slate-400">Floor Value</p>
                    <p className="mt-1 font-mono text-white">${formatBigint(position.floorValue, 6, 2)}</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                    <p className="text-xs text-slate-400">Ceiling Value</p>
                    <p className="mt-1 font-mono text-white">${formatBigint(position.ceilingValue, 6, 2)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
