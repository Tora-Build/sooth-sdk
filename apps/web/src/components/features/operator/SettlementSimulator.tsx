import React from 'react';
import { useReadContracts } from 'wagmi';
import { formatUnits } from 'viem';
import { MARKET_V4_ABI } from '../../../config/abis';
import { useDeployments } from '../../../hooks/useDeployments';
import marketsConfig from '../../../config/markets.json';
import { useMarketStore } from '../../../store/useMarketStore';
import { Card } from '../../ui/Card';
import { useContent } from '../../../hooks/useContent';
import { Market } from '../../../types';

export const SettlementSimulator: React.FC = () => {
  const { t } = useContent();
  const { mode, markets: demoMarkets } = useMarketStore();
  const { config } = useDeployments();
  const deployments = config.contracts;
  const riskManagerAddress = deployments.SoothRiskManager as `0x${string}`;
  // LP vault - use SoothGovernorVault in v2, fallback to SoothVault for v1
  const vaultAddress = (deployments.SoothGovernorVault || deployments.SoothVault) as `0x${string}`;

  // 1. Prepare Data Fetching for Real Mode
  const realMarkets = marketsConfig.markets.filter(m => m.mode === 'real');

  // Define MO_MARKET_ABI alias for V4
  const MO_MARKET_ABI = MARKET_V4_ABI;

  const marketContracts = realMarkets.flatMap(m => [
    {
      address: m.contractAddress as `0x${string}`,
      abi: MO_MARKET_ABI,
      functionName: 'b',
      args: [],
    },
    {
      address: m.contractAddress as `0x${string}`,
      abi: MO_MARKET_ABI,
      functionName: 'price',
      args: [0], // YES price
    },
    {
      address: m.contractAddress as `0x${string}`,
      abi: MO_MARKET_ABI,
      functionName: 'price',
      args: [1], // NO price
    },
    {
      address: m.contractAddress as `0x${string}`,
      abi: MO_MARKET_ABI,
      functionName: 'isLive',
    },
    {
      address: m.contractAddress as `0x${string}`,
      abi: MO_MARKET_ABI,
      functionName: 'isSettled',
    },
  ]);

  const { data: realData, isLoading } = useReadContracts({
    contracts: marketContracts as any,
    query: {
      enabled: mode === 'real',
      refetchInterval: 5000,
    }
  });

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(val);

  // 3. Render
  let activeMarkets: any[] = [];

  if (mode === 'demo') {
    // ... (Keep existing demo logic)
    const demoModeMarkets = demoMarkets.filter((m): m is Market =>
      (m as any).mode === 'demo' && m.status === 'trading'
    );
    activeMarkets = demoModeMarkets.map(m => {
      // ... (Keep mapping)
      // Copy paste from original file or keep mostly same
      const userSharesYes = m.userYesShares || 0;
      const userSharesNo = m.userNoShares || 0;
      const marketReserve = Number(formatUnits((m as any).reserve || 0n, 18));
      const b = Number(formatUnits(m.bParam || 0n, 18));
      const qYes = Number(formatUnits(m.qYes || 0n, 18));
      const qNo = Number(formatUnits(m.qNo || 0n, 18));
      let priceYes = 0.5;
      if (b > 0) {
        const expYes = Math.exp(qYes / b);
        const expNo = Math.exp(qNo / b);
        priceYes = expYes / (expYes + expNo);
      }
      const payoutYesWin = userSharesYes;
      const lpPnlYesWin = marketReserve - payoutYesWin;
      const payoutNoWin = userSharesNo;
      const lpPnlNoWin = marketReserve - payoutNoWin;
      return {
        id: m.id,
        name: m.question,
        status: m.status,
        marketReserve,
        priceYes,
        userSharesYes,
        userSharesNo,
        payoutYesWin,
        payoutNoWin,
        lpPnlYesWin,
        lpPnlNoWin
      };
    });
  } else if (realData) {
    activeMarkets = realMarkets.map((m: any, i: number) => {
      const baseIdx = i * 5;
      const bRes = realData[baseIdx];
      const priceYesRes = realData[baseIdx + 1];
      const priceNoRes = realData[baseIdx + 2];
      const isLiveRes = realData[baseIdx + 3];
      const isSettledRes = realData[baseIdx + 4];

      if (bRes?.result !== undefined && priceYesRes?.result !== undefined) {
        const bBig = bRes.result as bigint;
        const priceYesBig = priceYesRes.result as bigint;

        const b = Number(formatUnits(bBig, 18));
        const priceYes = Number(formatUnits(priceYesBig, 18));

        // Reserve: approximate as b * 0.1 for display (actual reserves from GovernorVault)
        const marketReserve = b * 0.1;

        // Placeholder user shares (would need actual balance fetching)
        const userSharesYes = 0;
        const userSharesNo = 0;

        const payoutYesWin = userSharesYes;
        const lpPnlYesWin = marketReserve - payoutYesWin;
        const payoutNoWin = userSharesNo;
        const lpPnlNoWin = marketReserve - payoutNoWin;

        let status = m.status;
        if (isLiveRes?.result !== undefined && isSettledRes?.result !== undefined) {
          const isLive = isLiveRes.result as boolean;
          const isSettled = isSettledRes.result as boolean;
          if (isSettled) status = 'settled';
          else if (isLive) status = 'trading';
          else status = 'cooldown';
        }

        return {
          id: m.id,
          name: m.name,
          status,
          marketReserve,
          priceYes,
          userSharesYes,
          userSharesNo,
          payoutYesWin,
          payoutNoWin,
          lpPnlYesWin,
          lpPnlNoWin
        };
      }
      return null;
    }).filter(Boolean);
  }

  return (
    <Card className="border-slate-800 bg-slate-900/50">
      <div className="p-6 border-b border-slate-800">
        <h2 className="text-lg font-semibold text-white">{t('simulator.title')}</h2>
        <p className="text-sm text-slate-400">{t('simulator.description')}</p>
      </div>

      <div className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-xs text-slate-500 border-b border-slate-800">
                <th className="py-3 px-4 font-medium uppercase tracking-wider">{t('stats.markets')}</th>
                <th className="py-3 px-4 font-medium uppercase tracking-wider text-right">{t('simulator.currentYes')}</th>
                <th className="py-3 px-4 font-medium uppercase tracking-wider text-right">{t('trading.marketReserves')}</th>
                <th className="py-3 px-4 font-medium uppercase tracking-wider text-right">{t('simulator.sharesYes')}</th>
                <th className="py-3 px-4 font-medium uppercase tracking-wider text-right">{t('simulator.sharesNo')}</th>
                <th className="py-3 px-4 font-medium uppercase tracking-wider text-right text-emerald-400">{t('simulator.payoutYes')}</th>
                <th className="py-3 px-4 font-medium uppercase tracking-wider text-right text-emerald-400">{t('simulator.pnlYes')}</th>
                <th className="py-3 px-4 font-medium uppercase tracking-wider text-right text-rose-400">{t('simulator.payoutNo')}</th>
                <th className="py-3 px-4 font-medium uppercase tracking-wider text-right text-rose-400">{t('simulator.pnlNo')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {activeMarkets.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    {mode === 'real' && isLoading ? t('common.loading') : t('trading.noActiveMarkets')}
                  </td>
                </tr>
              ) : (
                activeMarkets.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-4 px-4">
                      <div className="text-sm font-medium text-slate-200 max-w-xs truncate" title={m.name}>
                        {m.name}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right font-mono text-sm text-indigo-400">
                      {(m.priceYes * 100).toFixed(1)}%
                    </td>
                    <td className="py-4 px-4 text-right font-mono text-sm text-slate-300">
                      {formatCurrency(m.marketReserve)}
                    </td>
                    <td className="py-4 px-4 text-right font-mono text-sm text-emerald-400/80">
                      {m.userSharesYes.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-4 px-4 text-right font-mono text-sm text-rose-400/80">
                      {m.userSharesNo.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-4 px-4 text-right font-mono text-sm text-emerald-300">
                      {formatCurrency(m.payoutYesWin)}
                    </td>
                    <td className={`py-4 px-4 text-right font-mono text-sm font-bold ${m.lpPnlYesWin >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {m.lpPnlYesWin >= 0 ? '+' : ''}{formatCurrency(m.lpPnlYesWin)}
                    </td>
                    <td className="py-4 px-4 text-right font-mono text-sm text-rose-300">
                      {formatCurrency(m.payoutNoWin)}
                    </td>
                    <td className={`py-4 px-4 text-right font-mono text-sm font-bold ${m.lpPnlNoWin >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {m.lpPnlNoWin >= 0 ? '+' : ''}{formatCurrency(m.lpPnlNoWin)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
};
