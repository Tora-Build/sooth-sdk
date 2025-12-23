import React, { useMemo, useState } from 'react';
import { useAccount, useReadContracts, useWriteContract, usePublicClient } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { LAUNCHPAD_MARKET_ABI, SOOTH_MANUAL_ADJUDICATOR_ABI, SOOTH_OPTIMISTIC_ADJUDICATOR_ABI } from '../../../config/abis';
import { useLaunchpadMarkets } from '../../../hooks/v5/useLaunchpadMarkets';
import { useContent } from '../../../hooks/useContent';
import { useChainStore } from '../../../store/useChainStore';
import { Card } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import toast from 'react-hot-toast';

export function AdjudicatorConsole() {
  const { t } = useContent();
  const { selectedChainId } = useChainStore();
  const { markets, isLoading: isLoadingMarkets } = useLaunchpadMarkets();
  const { address: userAddress } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const [resolving, setResolving] = useState<Record<string, boolean>>({});
  const [outcomes, setOutcomes] = useState<Record<string, 0 | 1>>({});
  const [tStars, setTStars] = useState<Record<string, string>>({});

  // Fetch market adjudicator states
  const marketCalls = useMemo(() => {
    return markets.flatMap(m => [
      { address: m.address, abi: LAUNCHPAD_MARKET_ABI, functionName: 'adjudicator', chainId: Number(selectedChainId) },
      { address: m.address, abi: LAUNCHPAD_MARKET_ABI, functionName: 'isSettled', chainId: Number(selectedChainId) },
      { address: m.address, abi: LAUNCHPAD_MARKET_ABI, functionName: 'winningOutcome', chainId: Number(selectedChainId) },
      { address: m.address, abi: LAUNCHPAD_MARKET_ABI, functionName: 'tStar', chainId: Number(selectedChainId) },
    ]);
  }, [markets, selectedChainId]);

  const { data: marketStates, isLoading: isLoadingStates, refetch: refetchStates } = useReadContracts({
    contracts: marketCalls,
    query: { enabled: markets.length > 0 }
  });

  const handleResolve = async (marketAddress: `0x${string}`, adjudicatorAddress: `0x${string}`) => {
    const outcome = outcomes[marketAddress] ?? 0;
    
    // V7: tStar is a truth-time (Unix timestamp)
    // Default to current time if not provided
    const tStarStr = tStars[marketAddress];
    const tStar = tStarStr ? BigInt(Math.floor(Number(tStarStr))) : BigInt(Math.floor(Date.now() / 1000));

    setResolving(prev => ({ ...prev, [marketAddress]: true }));
    const toastId = toast.loading('Resolving market...');

    try {
      // V7 Settlement Logic:
      // 1. If the adjudicator is an EOA (e.g. the user themselves), call finalizeResolution on the market.
      // 2. If the adjudicator is a contract, call resolve() on that contract.
      
      const isEoaAdjudicator = adjudicatorAddress.toLowerCase() === userAddress?.toLowerCase();

      if (isEoaAdjudicator) {
        const hash = await writeContractAsync({
          address: marketAddress,
          abi: LAUNCHPAD_MARKET_ABI,
          functionName: 'finalizeResolution',
          args: [outcome, tStar],
        });
        await publicClient?.waitForTransactionReceipt({ hash });
      } else {
        const hash = await writeContractAsync({
          address: adjudicatorAddress,
          abi: SOOTH_MANUAL_ADJUDICATOR_ABI,
          functionName: 'resolve',
          args: [marketAddress, outcome, tStar],
        });
        await publicClient?.waitForTransactionReceipt({ hash });
      }

      toast.success('Market resolved!', { id: toastId });
      refetchStates();
    } catch (error: any) {
      console.error('Resolution error:', error);
      toast.error(error.message?.split('\n')[0] || 'Resolution failed', { id: toastId });
    } finally {
      setResolving(prev => ({ ...prev, [marketAddress]: false }));
    }
  };

  if (isLoadingMarkets || isLoadingStates) {
    return <div className="text-slate-400 font-mono italic">Loading markets...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4">
        {markets.map((market, i) => {
          const baseIdx = i * 4;
          const adjudicator = marketStates?.[baseIdx]?.result as `0x${string}`;
          const isSettled = !!marketStates?.[baseIdx + 1]?.result;
          const winningOutcome = marketStates?.[baseIdx + 2]?.result as number;
          const tStarVal = marketStates?.[baseIdx + 3]?.result as bigint;

          return (
            <Card key={market.address} className="p-6 bg-slate-900/50 border-slate-800">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white">{market.name}</h3>
                    <Badge variant={isSettled ? 'success' : 'indigo'}>
                      {isSettled ? t('trading.settled') : t('trading.trading')}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-500 font-mono">{market.address}</p>
                  <p className="text-xs text-slate-400 font-mono">
                    Adjudicator: <span className="text-cyan-400">{adjudicator}</span>
                  </p>
                </div>

                {!isSettled ? (
                  <div className="flex flex-wrap items-center gap-4 bg-slate-950/50 p-4 rounded-lg border border-slate-800">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Outcome</label>
                      <select 
                        className="bg-slate-900 border border-slate-700 text-white text-sm rounded px-2 py-1 outline-none focus:border-cyan-500"
                        value={outcomes[market.address] ?? 0}
                        onChange={(e) => setOutcomes(prev => ({ ...prev, [market.address]: Number(e.target.value) as 0 | 1 }))}
                      >
                        <option value={0}>YES</option>
                        <option value={1}>NO</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">T* (Time)</label>
                      <Input 
                        type="text" 
                        placeholder={Math.floor(Date.now() / 1000).toString()}
                        className="w-32 h-8 bg-slate-900 font-mono text-[10px]"
                        value={tStars[market.address] || ''}
                        onChange={(e) => setTStars(prev => ({ ...prev, [market.address]: e.target.value }))}
                      />
                    </div>

                    <Button 
                      size="sm" 
                      variant="primary"
                      onClick={() => handleResolve(market.address, adjudicator)}
                      disabled={resolving[market.address] || !adjudicator}
                    >
                      {resolving[market.address] ? '...' : t('operator.resolve')}
                    </Button>
                  </div>
                ) : (
                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Result</div>
                    <div className="text-white font-mono">
                      Winner: <span className={winningOutcome === 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {winningOutcome === 0 ? 'YES' : 'NO'}
                      </span>
                      <span className="mx-2 text-slate-700">|</span>
                      T*: <span className="text-cyan-400">{formatUnits(tStarVal || 0n, 18)}</span>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

