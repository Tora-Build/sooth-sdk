import React, { useMemo, useState } from 'react';
import { useReadContracts, useWriteContract, usePublicClient } from 'wagmi';
import { LAUNCHPAD_MARKET_ABI } from '../../../config/abis';
import { useLaunchpadMarkets } from '../../../hooks/useLaunchpadMarkets';
import { useContent } from '../../../hooks/useContent';
import { useChainStore } from '../../../store/useChainStore';
import { Card } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import toast from 'react-hot-toast';

export function GuardianConsole() {
  const { t } = useContent();
  const { selectedChainId } = useChainStore();
  const { markets, isLoading: isLoadingMarkets } = useLaunchpadMarkets();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const [isPending, setIsPending] = useState<Record<string, boolean>>({});

  const chainId = selectedChainId ? Number(selectedChainId) : undefined;

  // Fetch market guardian states
  const marketCalls = useMemo(() => {
    return markets.flatMap(m => [
      { address: m.address, abi: LAUNCHPAD_MARKET_ABI, functionName: 'isLive', chainId },
      { address: m.address, abi: LAUNCHPAD_MARKET_ABI, functionName: 'isGraduated', chainId },
      { address: m.address, abi: LAUNCHPAD_MARKET_ABI, functionName: 'isLiquidated', chainId },
    ]);
  }, [markets, chainId]);

  const { data: marketStates, isLoading: isLoadingStates, refetch: refetchStates } = useReadContracts({
    contracts: marketCalls,
    query: { enabled: markets.length > 0 && !!chainId }
  });

  const handleGuardianAction = async (marketAddress: `0x${string}`, action: 'forceGraduate' | 'liquidate') => {
    setIsPending(prev => ({ ...prev, [`${marketAddress}-${action}`]: true }));
    const toastId = toast.loading(`${action === 'forceGraduate' ? 'Graduating' : 'Liquidating'} market...`);

    try {
      const hash = await writeContractAsync({
        address: marketAddress,
        abi: LAUNCHPAD_MARKET_ABI,
        functionName: action,
      });

      await publicClient?.waitForTransactionReceipt({ hash });
      toast.success('Action successful!', { id: toastId });
      refetchStates();
    } catch (error: any) {
      console.error('Guardian error:', error);
      toast.error(error.message?.split('\n')[0] || 'Action failed', { id: toastId });
    } finally {
      setIsPending(prev => ({ ...prev, [`${marketAddress}-${action}`]: false }));
    }
  };

  if (isLoadingMarkets || isLoadingStates) {
    return <div className="text-slate-400 font-mono italic">Loading markets...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4">
        {markets.map((market, i) => {
          const baseIdx = i * 3;
          const isLive = !!marketStates?.[baseIdx]?.result;
          const isGraduated = !!marketStates?.[baseIdx + 1]?.result;
          const isLiquidated = !!marketStates?.[baseIdx + 2]?.result;

          return (
            <Card key={market.address} className="p-6 bg-slate-900/50 border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white">{market.name}</h3>
                    <Badge variant={isGraduated ? 'success' : isLiquidated ? 'destructive' : 'indigo'}>
                      {isGraduated ? 'Graduated' : isLiquidated ? 'Liquidated' : isLive ? 'Bonding' : 'Ended'}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-500 font-mono">{market.address}</p>
                </div>

                <div className="flex items-center gap-3">
                  {!isGraduated && !isLiquidated && (
                    <>
                      {isLive ? (
                        <Button 
                          size="sm" 
                          variant="cyan"
                          className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 hover:bg-cyan-500/20"
                          onClick={() => handleGuardianAction(market.address, 'forceGraduate')}
                          disabled={isPending[`${market.address}-forceGraduate`]}
                        >
                          {isPending[`${market.address}-forceGraduate`] ? '...' : 'Force Graduate'}
                        </Button>
                      ) : (
                        <Button 
                          size="sm" 
                          variant="destructive"
                          className="bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20"
                          onClick={() => handleGuardianAction(market.address, 'liquidate')}
                          disabled={isPending[`${market.address}-liquidate`]}
                        >
                          {isPending[`${market.address}-liquidate`] ? '...' : 'Liquidate'}
                        </Button>
                      )}
                    </>
                  )}
                  {(isGraduated || isLiquidated) && (
                    <span className="text-slate-600 text-xs italic font-mono">// no_actions_needed</span>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

