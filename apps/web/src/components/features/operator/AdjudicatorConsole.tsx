import React, { useState } from 'react';
import { useReadContracts } from 'wagmi';
import { useMarketStore } from '../../../store/useMarketStore';
import { useSettlement } from '../../../hooks/useSettlement';
import { useChainStore } from '../../../store/useChainStore';
import { MARKET_V4_ABI } from '../../../config/abis';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import { Input } from '../../ui/Input';
import { useContent } from '../../../hooks/useContent';

const MarketRow: React.FC<{ market: any }> = ({ market }) => {
  const { t } = useContent();
  const { adjudicate, uploadPnL, isPending } = useSettlement(market.id);
  const [pnlRoot, setPnlRoot] = useState('');

  return (
    <tr className="border-b border-slate-800/50 hover:bg-slate-900/30 transition-colors">
      <td className="py-4 px-4">
        <div className="font-medium text-white">{market.question}</div>
        <div className="text-xs text-slate-500">ID: {market.id}</div>
      </td>
      <td className="py-4 px-4">
        <Badge variant={
          market.status === 'trading' ? 'success' :
            market.status === 'settled' ? 'default' : 'warning'
        }>
          {t(`trading.${market.status}` as any) || market.status}
        </Badge>
      </td>
      <td className="py-4 px-4">
        {market.status === 'settling' ? (
          <div className="flex gap-2">
            <Button size="sm" variant="success" onClick={() => adjudicate('YES')} disabled={isPending}>YES</Button>
            <Button size="sm" variant="danger" onClick={() => adjudicate('NO')} disabled={isPending}>NO</Button>
          </div>
        ) : market.status === 'clearing' && !market.adjudicatorProofUploaded ? (
          <div className="flex gap-2 items-center">
            <Input
              placeholder="0x..."
              value={pnlRoot}
              onChange={(e) => setPnlRoot(e.target.value)}
              className="h-8 text-xs w-32"
            />
            <Button size="sm" onClick={() => uploadPnL(pnlRoot)} disabled={isPending || !pnlRoot}>{t('operator.upload')}</Button>
          </div>
        ) : market.status === 'settled' ? (
          <div className="text-xs text-slate-500">
            {t('operator.winner')}: <span className={market.winningOutcome === 'YES' ? 'text-emerald-400' : 'text-rose-400'}>{market.winningOutcome}</span>
          </div>
        ) : (
          <span className="text-xs text-slate-600">{t('operator.noActions')}</span>
        )}
      </td>
    </tr>
  );
};

export const AdjudicatorConsole: React.FC = () => {
  const { t } = useContent();
  const { markets, mode } = useMarketStore();
  const { selectedChainId } = useChainStore();

  const filteredMarkets = markets.filter(m => {
    if (m.mode !== mode) return false;
    if (mode === 'real') {
      return m.chainId === undefined || m.chainId === selectedChainId;
    }
    return true;
  });

  // Fetch market status for real mode
  const { data: marketStatuses } = useReadContracts({
    contracts: filteredMarkets.flatMap(m => [
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
      enabled: mode === 'real' && filteredMarkets.length > 0,
    }
  });

  // Merge blockchain status with market data
  const marketsWithStatus = filteredMarkets.map((market, i) => {
    if (mode === 'real' && marketStatuses) {
      const statusIdx = i * 2;
      const isLiveResult = marketStatuses[statusIdx];
      const isSettledResult = marketStatuses[statusIdx + 1];

      if (isLiveResult?.status === 'success' && isSettledResult?.status === 'success') {
        const isLive = isLiveResult.result as boolean;
        const isSettled = isSettledResult.result as boolean;

        let status = market.status;
        if (isSettled) {
          status = 'settled';
        } else if (isLive) {
          status = 'trading';
        } else {
          status = 'cooldown';
        }

        return { ...market, status };
      }
    }
    return market;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-heading font-bold text-white">{t('operator.title')}</h2>
          <p className="text-slate-400 text-sm">{t('operator.description')}</p>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-slate-500 border-b border-slate-800">
                <th className="pb-3 px-4 font-medium">{t('stats.markets')}</th>
                <th className="pb-3 px-4 font-medium">{t('trading.marketStatus')}</th>
                <th className="pb-3 px-4 font-medium">{t('operator.resolve')}</th>
              </tr>
            </thead>
            <tbody>
              {marketsWithStatus.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-slate-500">
                    {t('trading.noMarkets')}
                  </td>
                </tr>
              ) : (
                marketsWithStatus.map(market => (
                  <MarketRow key={market.id} market={market} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
