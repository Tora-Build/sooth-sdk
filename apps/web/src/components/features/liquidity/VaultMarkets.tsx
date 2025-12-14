import React from 'react';
import { useReadContracts } from 'wagmi';
import { formatUnits } from 'viem';
import { Card } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { useMarketStore } from '../../../store/useMarketStore';
import { MARKET_V4_ABI, SOOTH_GOVERNOR_VAULT_ABI } from '../../../config/abis';
import { useDeployments } from '../../../hooks/useDeployments';
import { useChainStore } from '../../../store/useChainStore';
import { useContent } from '../../../hooks/useContent';

export const VaultMarkets: React.FC = () => {
  const { t } = useContent();
  const { markets, mode } = useMarketStore();
  const { selectedChainId } = useChainStore();
  const { config } = useDeployments();
  const deployments = config.contracts;
  // LP vault - use SoothGovernorVault
  const vaultAddress = deployments.SoothGovernorVault as `0x${string}`;

  // Filter markets that are relevant
  const activeMarkets = markets.filter(m => {
    if (mode === 'real') {
      return m.mode === 'real' &&
        m.id_numeric !== undefined &&
        (m.chainId === undefined || m.chainId === selectedChainId);
    }
    return m.mode === 'demo';
  });



  // Fetch b from Market contract directly
  const { data: bParams } = useReadContracts({
    contracts: activeMarkets.map(m => ({
      address: m.contractAddress as `0x${string}`,
      abi: MARKET_V4_ABI,
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
        abi: MARKET_V4_ABI,
        functionName: 'isLive',
      },
      {
        address: m.contractAddress as `0x${string}`,
        abi: MARKET_V4_ABI,
        functionName: 'isSettled',
      },
    ]),
    query: {
      enabled: mode === 'real',
    }
  });

  // Fetch marketReserves from GovernorVault for each market
  const { data: marketReservesData } = useReadContracts({
    contracts: activeMarkets.map(m => ({
      address: vaultAddress,
      abi: SOOTH_GOVERNOR_VAULT_ABI,
      functionName: 'getMarketReserve',
      args: [BigInt(m.id_numeric || 0)],
    })),
    query: {
      enabled: mode === 'real' && !!vaultAddress,
    }
  });

  // Fetch YES prices from markets for dynamic solvency factor
  const { data: yesPricesData } = useReadContracts({
    contracts: activeMarkets.map(m => ({
      address: m.contractAddress as `0x${string}`,
      abi: MARKET_V4_ABI,
      functionName: 'price',
      args: [0], // outcome 0 = YES
    })),
    query: {
      enabled: mode === 'real',
    }
  });

  // Fetch bBase from each market (the base allocation from vault)
  const { data: bBaseParams } = useReadContracts({
    contracts: activeMarkets.map(m => ({
      address: m.contractAddress as `0x${string}`,
      abi: MARKET_V4_ABI,
      functionName: 'bBase',
    })),
    query: {
      enabled: mode === 'real',
    }
  });

  // Calculate solvency factor from YES price: p*ln(p) + (1-p)*ln(1-p)
  const calcSolvencyFactor = (pYes: number): number => {
    if (pYes <= 0.001 || pYes >= 0.999) return 0.01; // edge case protection
    return Math.abs(pYes * Math.log(pYes) + (1 - pYes) * Math.log(1 - pYes));
  };

  const isLoading = mode === 'real' && !marketStatuses;

  const multiplierFormatted = '10%'; // reserveFactorBps = 1000 = 10%

  // Calculate Total Locked using dynamic solvency factors
  const totalLocked = bParams?.reduce((acc, r, i) => {
    const b = r.result ? (r.result as bigint) : 0n;
    const bNum = Number(formatUnits(b, 18));
    // Get YES price for this market
    const yesPriceResult = yesPricesData?.[i]?.result;
    const pYes = yesPriceResult !== undefined
      ? Number(formatUnits(yesPriceResult as bigint, 18))
      : 0.5;
    const sf = calcSolvencyFactor(pYes);
    return acc + bNum * sf;
  }, 0) || 0;

  // Demo mode: use hardcoded 0.693
  const demoTotalLocked = activeMarkets.reduce((acc, market) => {
    const b = Number(formatUnits(market.bParam || 0n, 18));
    return acc + (b * 0.693);
  }, 0);

  const displayTotalLocked = mode === 'demo'
    ? `$${demoTotalLocked.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    : (isLoading ? '...' : `$${totalLocked.toLocaleString(undefined, { maximumFractionDigits: 2 })}`);

  return (
    <Card className="mt-6 border-slate-800 bg-slate-900/20">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h3 className="font-heading font-bold text-xl text-white">{t('lp.activeMarkets')}</h3>
          <p className="text-sm text-slate-400 mt-1">
            {t('lp.realTimeTracking')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
            <div className="text-xs text-slate-500 uppercase tracking-wider font-medium">Reserve Factor</div>
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
              <th className="pb-3 pl-2 font-medium">{t('stats.markets')}</th>
              <th className="pb-3 font-medium">{t('lp.risk')}</th>
              <th className="pb-3 font-medium">{t('trading.marketStatus')}</th>
              <th className="pb-3 font-medium text-right group/header relative">
                <span className="border-b border-dotted border-slate-600 cursor-help">{t('trading.liquidity')} (b)</span>
                <div className="absolute bottom-full right-0 mb-2 w-80 p-3 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-300 shadow-xl opacity-0 invisible group-hover/header:opacity-100 group-hover/header:visible transition-all z-10">
                  <p className="font-semibold text-white mb-1">{t('lp.hybridLiquidity')}</p>
                  <p className="mb-2">
                    {t('trading.liquidityGrow')}
                  </p>
                  <div className="space-y-2 pt-2 border-t border-slate-700/50">
                    <div>
                      <p className="text-[10px] text-slate-400 font-mono">{t('lp.formula')}:</p>
                      <p className="font-mono text-blue-400">b = b_base + (reserves × factor / 10000)</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-mono">{t('lp.components')}:</p>
                      <ul className="list-disc list-inside text-[10px] text-slate-500">
                        <li><span className="text-slate-300">b_base:</span> Global vault allocation to market</li>
                        <li><span className="text-slate-300">reserves:</span> Cumulative market PnL</li>
                        <li><span className="text-slate-300">factor:</span> {multiplierFormatted} (reserveFactorBps = 1000)</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </th>
              <th className="pb-3 font-medium text-right">b_base</th>
              <th className="pb-3 font-medium text-right">Reserves</th>
              <th className="pb-3 font-medium text-right group/header relative">
                <span className="border-b border-dotted border-slate-600 cursor-help">Solvency Factor</span>
                <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-300 shadow-xl opacity-0 invisible group-hover/header:opacity-100 group-hover/header:visible transition-all z-10">
                  <p className="font-semibold text-white mb-1">solvencyFactor(p)</p>
                  <p className="font-mono text-amber-400 mb-2">= p·ln(p) + (1-p)·ln(1-p)</p>
                  Dynamic based on YES price (p).<br />
                  At 50%: 0.693 • At 90%: 0.325
                </div>
              </th>
              <th className="pb-3 pr-2 font-medium text-right group/header relative">
                <span className="border-b border-dotted border-slate-600 cursor-help">Locked Exposure</span>
                <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-300 shadow-xl opacity-0 invisible group-hover/header:opacity-100 group-hover/header:visible transition-all z-10">
                  <p className="font-semibold text-white mb-1">lockedExposure = b × solvencyFactor</p>
                  Capital locked to guarantee solvency. This is the worst-case payout if market resolves against the vault.
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {activeMarkets.map((market, i) => {
              const bParam = bParams?.[i]?.result;
              const configBParam = market.bParam || 0n;
              const finalBParam = mode === 'demo' ? configBParam : ((bParam as bigint) || configBParam);
              const bValue = Number(formatUnits(finalBParam, 18));

              // Get YES price and calculate dynamic solvency factor
              const yesPriceResult = yesPricesData?.[i]?.result;
              const pYes = yesPriceResult !== undefined
                ? Number(formatUnits(yesPriceResult as bigint, 18))
                : 0.5; // default to 50%
              const solvencyFactor = calcSolvencyFactor(pYes);
              const lockedExposure = bValue * solvencyFactor;

              const displayLocked = mode === 'demo'
                ? `${(bValue * 0.693).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : (bParam === undefined ? '...' : `${lockedExposure.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

              // Fetch market reserves from GovernorVault (WAD = 18 decimals)
              const reserveResult = marketReservesData?.[i]?.result;
              const reserveValue = reserveResult !== undefined ? Number(formatUnits(reserveResult as bigint, 18)) : 0;
              const displayReserve = mode === 'demo'
                ? '-'
                : (reserveResult === undefined ? '...' : `$${reserveValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

              const bFormatted = formatUnits(finalBParam, 18);
              const displayB = mode === 'demo'
                ? `${bValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : (bParam === undefined ? '...' : `${parseFloat(bFormatted).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

              // Get bBase from contract (base allocation before reserves boost)
              const bBaseParam = bBaseParams?.[i]?.result;
              const bBaseValue = bBaseParam !== undefined
                ? Number(formatUnits(bBaseParam as bigint, 18))
                : bValue; // fallback to b if bBase not available

              const displayBase = mode === 'demo'
                ? `${bValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : (bBaseParam === undefined ? '...' : `${bBaseValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

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
                      {t(`trading.${displayStatus}` as any) || displayStatus}
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
                      return solvencyFactor.toFixed(4);
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
                  {t('trading.noActiveMarkets')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
