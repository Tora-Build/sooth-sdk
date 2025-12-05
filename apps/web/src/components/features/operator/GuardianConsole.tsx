import React from 'react';
import { useReadContracts } from 'wagmi';
import { useMarketStore } from '../../../store/useMarketStore';
import { useGuardian } from '../../../hooks/useGuardian';
import { useChainStore } from '../../../store/useChainStore';
import { SOOTH_MARKET_ABI } from '../../../config/abis';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';

const GuardianRow: React.FC<{ market: any }> = ({ market }) => {
  const { pauseMarket, unpauseMarket, forceSettle, isPending } = useGuardian(market.id);

  return (
    <tr className="border-b border-slate-800/50 hover:bg-slate-900/30 transition-colors">
      <td className="py-4 px-4">
        <div className="font-medium text-white">{market.question}</div>
        <div className="text-xs text-slate-500">ID: {market.id}</div>
      </td>
      <td className="py-4 px-4">
        <Badge variant={
          market.status === 'trading' ? 'success' :
          market.status === 'settled' ? 'default' :
          market.status === 'paused' ? 'danger' : 'warning'
        }>
          {market.status}
        </Badge>
      </td>
      <td className="py-4 px-4 flex gap-2">
        {market.status === 'paused' ? (
          <Button size="sm" variant="success" onClick={unpauseMarket} disabled={isPending}>Unpause</Button>
        ) : (
          <Button size="sm" variant="danger" onClick={pauseMarket} disabled={isPending}>Pause</Button>
        )}
        <div className="h-8 w-px bg-slate-800 mx-2" />
        <Button size="sm" variant="danger" className="opacity-75 hover:opacity-100" onClick={() => forceSettle('YES')} disabled={isPending}>Force YES</Button>
        <Button size="sm" variant="danger" className="opacity-75 hover:opacity-100" onClick={() => forceSettle('NO')} disabled={isPending}>Force NO</Button>
      </td>
    </tr>
  );
};

export const GuardianConsole: React.FC = () => {
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
          <h2 className="text-2xl font-heading font-bold text-white">Guardian Console</h2>
          <p className="text-slate-400 text-sm">Emergency controls and market pausing.</p>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-slate-500 border-b border-slate-800">
                <th className="pb-3 px-4 font-medium">Market</th>
                <th className="pb-3 px-4 font-medium">Status</th>
                <th className="pb-3 px-4 font-medium">Emergency Controls</th>
              </tr>
            </thead>
            <tbody>
              {marketsWithStatus.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-slate-500">
                    No markets found in {mode} mode.
                  </td>
                </tr>
              ) : (
                marketsWithStatus.map(market => (
                  <GuardianRow key={market.id} market={market} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
