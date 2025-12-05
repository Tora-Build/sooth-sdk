import React from 'react';
import { useReadContracts } from 'wagmi';
import { formatUnits } from 'viem';
import { Card } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { useMarketStore } from '../../../store/useMarketStore';
import { SOOTH_VAULT_ABI, SOOTH_RISK_MANAGER_ABI, SOOTH_MARKET_ABI } from '../../../config/abis';
import { useDeployments } from '../../../hooks/useDeployments';

import { useChainStore } from '../../../store/useChainStore';

export const VaultMarkets: React.FC = () => {
  const { markets, mode } = useMarketStore();
  const { selectedChainId } = useChainStore();
  const deployments = useDeployments();
  // LP vault - use SoothGovernorVault in v2, fallback to SoothVault for v1
  const vaultAddress = (deployments.SoothGovernorVault || deployments.SoothVault) as `0x${string}`;

  // Filter markets that are relevant
  // For Real mode: only markets with id_numeric AND matching chainId
  // For Demo mode: all demo markets
  const activeMarkets = markets.filter(m => {
    if (mode === 'real') {
      return m.mode === 'real' && 
             m.id_numeric !== undefined && 
             (m.chainId === undefined || m.chainId === selectedChainId);
    }
    return m.mode === 'demo';
  });

  const { data: lockedExposures, isLoading } = useReadContracts({
    contracts: activeMarkets.map(m => ({
      address: vaultAddress,
      abi: SOOTH_VAULT_ABI,
      functionName: 'lockedExposure',
      args: [BigInt(m.id_numeric || 0)],
    })),
    query: {
      enabled: mode === 'real',
    }
  });

  const { data: marketReserves } = useReadContracts({
    contracts: activeMarkets.map(m => ({
      address: vaultAddress,
      abi: SOOTH_VAULT_ABI,
      functionName: 'getMarketReserve',
      args: [BigInt(m.id_numeric || 0)],
    })),
    query: {
      enabled: mode === 'real',
    }
  });

  // Fetch b from Market contract directly
  const { data: bParams } = useReadContracts({
    contracts: activeMarkets.map(m => ({
      address: m.contractAddress as `0x${string}`,
      abi: SOOTH_MARKET_ABI,
      functionName: 'b',
    })),
    query: {
      enabled: mode === 'real',
    }
  });

  // Fetch market status (isLive and isSettled) for real mode
  const { data: marketStatuses } = useReadContracts({
    contracts: activeMarkets.flatMap(m => [
      {
        address: m.contractAddress as `0x${string}`,
        abi: SOOTH_MARKET_ABI,
        functionName: 'isLive',
      },
      {
        address: m.contractAddress as `0x${string}`,
        abi: SOOTH_MARKET_ABI,
        functionName: 'isSettled',
      },
    ]),
    query: {
      enabled: mode === 'real',
    }
  });

  const multiplierFormatted = '1.00x'; // Fixed in v3 (Governor sets b directly)

  // Calculate Total Locked (Real Mode)
  const totalLocked = lockedExposures?.reduce((acc, r) => {
    return acc + (r.result ? (r.result as bigint) : 0n);
  }, 0n) || 0n;

  // Calculate Total Locked (Demo Mode)
  const demoTotalLocked = activeMarkets.reduce((acc, market) => {
    const b = Number(formatUnits(market.bParam || 0n, 18));
    return acc + (b * 0.693);
  }, 0);

  const displayTotalLocked = mode === 'demo'
    ? `$${demoTotalLocked.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    : (isLoading ? '...' : `$${parseFloat(formatUnits(totalLocked, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })}`);

  return (
    <Card className="mt-6 border-slate-800 bg-slate-900/20">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h3 className="font-heading font-bold text-xl text-white">Active Markets & Exposure</h3>
          <p className="text-sm text-slate-400 mt-1">
            Real-time tracking of vault capital locked across different markets.
          </p>
        </div>
        <div className="flex items-center gap-3">
            <div className="px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <div className="text-xs text-slate-500 uppercase tracking-wider font-medium">Reserve Multiplier</div>
                <div className="text-lg font-mono font-medium text-slate-300">{multiplierFormatted}</div>
            </div>
            <div className="px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <div className="text-xs text-slate-500 uppercase tracking-wider font-medium">Total Locked</div>
                <div className="text-lg font-mono font-medium text-amber-400">{displayTotalLocked}</div>
            </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-slate-500 border-b border-slate-800">
              <th className="pb-3 pl-2 font-medium">Market</th>
              <th className="pb-3 font-medium">Risk Level</th>
              <th className="pb-3 font-medium">Status</th>
              <th className="pb-3 font-medium text-right group/header relative">
                <span className="border-b border-dotted border-slate-600 cursor-help">Liquidity (b)</span>
                <div className="absolute bottom-full right-0 mb-2 w-80 p-3 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-300 shadow-xl opacity-0 invisible group-hover/header:opacity-100 group-hover/header:visible transition-all z-10">
                  <p className="font-semibold text-white mb-1">Hybrid Liquidity (Dynamic)</p>
                  <p className="mb-2">
                    Liquidity 'b' grows as the market earns spreads.
                  </p>
                  <div className="space-y-2 pt-2 border-t border-slate-700/50">
                    <div>
                      <p className="text-[10px] text-slate-400 font-mono">Formula:</p>
                      <p className="font-mono text-blue-400">b = Base + (Reserve × Multiplier)</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-mono">Components:</p>
                      <ul className="list-disc list-inside text-[10px] text-slate-500">
                        <li><span className="text-slate-300">Base:</span> Global vault allocation</li>
                        <li><span className="text-slate-300">Reserve:</span> Market's accumulated spreads</li>
                        <li><span className="text-slate-300">Multiplier:</span> {multiplierFormatted} (Current)</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </th>
              <th className="pb-3 font-medium text-right">Base Liquidity</th>
              <th className="pb-3 font-medium text-right">Market Reserve</th>
              <th className="pb-3 font-medium text-right group/header relative">
                <span className="border-b border-dotted border-slate-600 cursor-help">Solvency Factor</span>
                <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-300 shadow-xl opacity-0 invisible group-hover/header:opacity-100 group-hover/header:visible transition-all z-10">
                  <p className="font-semibold text-white mb-1">Locked / b Ratio</p>
                  The ratio of capital locked per unit of liquidity depth.
                  <br/><br/>
                  <span className="font-mono text-amber-400">~0.693</span> for balanced markets.
                  <br/>
                  Changes as the market price shifts.
                </div>
              </th>
              <th className="pb-3 pr-2 font-medium text-right group/header relative">
                <span className="border-b border-dotted border-slate-600 cursor-help">Max Loss (Locked)</span>
                <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-300 shadow-xl opacity-0 invisible group-hover/header:opacity-100 group-hover/header:visible transition-all z-10">
                  <p className="font-semibold text-white mb-1">Worst-Case Payout</p>
                  This is the maximum amount the vault could lose if the market resolves against its position. This capital is "locked" to ensure solvency.
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {activeMarkets.map((market, i) => {
              const lockedResult = lockedExposures?.[i];
              const locked = lockedResult?.status === 'success' ? lockedResult.result as bigint : undefined;
              
              // Use actual market bParam for both demo and real modes
              const bParam = bParams?.[i]?.result;
              const configBParam = market.bParam || 0n;
              const finalBParam = mode === 'demo' ? configBParam : ((bParam as bigint) || configBParam);
              const bValue = Number(formatUnits(finalBParam, 18));

              const displayLocked = mode === 'demo' 
                ? `${(bValue * 0.693).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : (locked !== undefined ? parseFloat(formatUnits(locked, 18)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-');

              // Use actual reserve from market object in demo mode
              const marketReserve = (market as any).reserve || 0n;
              const reserveResult = marketReserves?.[i];
              const reserve = reserveResult?.status === 'success' ? reserveResult.result as bigint : undefined;
              const displayReserve = mode === 'demo'
                ? `${Number(formatUnits(marketReserve, 18)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : (reserve !== undefined ? parseFloat(formatUnits(reserve, 18)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-');

              const bFormatted = formatUnits(finalBParam, 18);

              // Display b value
              const displayB = mode === 'demo'
                ? `${bValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : (isLoading ? '...' : `${parseFloat(bFormatted).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

              // Calculate Base Liquidity
              // For demo: use market.baseLiquidity from store
              // For real: calculate as b - reserve
              const marketBaseLiquidity = (market as any).baseLiquidity || 0n;
              const reserveValue = mode === 'demo' 
                ? Number(formatUnits(marketReserve, 18))
                : (reserve !== undefined ? Number(formatUnits(reserve, 18)) : 0);
              
              const baseValue = mode === 'demo' 
                ? Number(formatUnits(marketBaseLiquidity, 18))
                : (bValue - reserveValue); // b - reserve for real mode
              
              const displayBase = mode === 'demo'
                ? `${baseValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : (isLoading ? '...' : `${baseValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

              // Get market status
              let displayStatus = market.status;
              if (mode === 'real' && marketStatuses) {
                const statusIdx = i * 2;
                const isLiveResult = marketStatuses[statusIdx];
                const isSettledResult = marketStatuses[statusIdx + 1];
                
                if (isLiveResult?.status === 'success' && isSettledResult?.status === 'success') {
                  const isLive = isLiveResult.result as boolean;
                  const isSettled = isSettledResult.result as boolean;
                  
                  if (isSettled) {
                    displayStatus = 'settled';
                  } else if (isLive) {
                    displayStatus = 'trading';
                  } else {
                    displayStatus = 'cooldown';
                  }
                }
              }

              return (
                <tr key={market.id} className="group hover:bg-slate-800/30 transition-colors">
                  <td className="py-4 pl-2 pr-4">
                    <div className="font-medium text-slate-200">{market.name}</div>
                    <div className="text-xs text-slate-500 truncate max-w-[250px]">{market.question}</div>
                  </td>
                  <td className="py-4">
                     {market.riskLevel && (
                        <Badge variant="outline" className={`
                          text-[10px] px-1.5 py-0.5
                          ${market.riskLevel === 'LOW' ? 'text-emerald-400 border-emerald-400/20 bg-emerald-400/10' : ''}
                          ${market.riskLevel === 'MEDIUM' ? 'text-amber-400 border-amber-400/20 bg-amber-400/10' : ''}
                          ${market.riskLevel === 'HIGH' ? 'text-rose-400 border-rose-400/20 bg-rose-400/10' : ''}
                        `}>
                          {market.riskLevel}
                        </Badge>
                     )}
                  </td>
                  <td className="py-4">
                    <Badge variant={displayStatus === 'trading' ? 'success' : 'default'} className="capitalize text-[10px]">
                      {displayStatus}
                    </Badge>
                  </td>
                  <td className="py-4 text-right font-mono text-blue-400">
                    {displayB}
                  </td>
                  <td className="py-4 text-right font-mono text-slate-300">
                    {displayBase}
                  </td>
                  <td className="py-4 text-right font-mono text-emerald-400">
                    {displayReserve}
                  </td>
                  <td className="py-4 text-right font-mono text-slate-400">
                    {(() => {
                      if (mode === 'demo') return '0.693';
                      const bVal = finalBParam ? parseFloat(formatUnits(finalBParam, 18)) : 0;
                      const lockedVal = locked !== undefined ? parseFloat(formatUnits(locked, 18)) : undefined;
                      
                      if (lockedVal === undefined) return '-';
                      return bVal > 0 ? (lockedVal / bVal).toFixed(4) : '-';
                    })()}
                  </td>
                  <td className="py-4 pr-2 text-right font-mono text-amber-400">
                    {displayLocked}
                  </td>
                </tr>
              );
            })}
            {activeMarkets.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-slate-500">
                  No active markets found for this vault.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
