import React from 'react';
import { useReadContracts, useChainId } from 'wagmi';
import { formatUnits } from 'viem';
import { MARKET_V4_ABI } from '../config/abis';
import marketsConfig from '../config/markets.json';
import { Market } from '../types';
import { useChainStore } from '../store/useChainStore';
import { useMarketStore } from '../store/useMarketStore';
import { getPollingInterval } from '../lib/polling';

export function useAmmMarket(marketId: string) {
  return useEVMMarket(marketId);
}

function useEVMMarket(marketId: string) {
  const walletChainId = useChainId();
  const { mode, refreshKey } = useMarketStore();
  const { selectedChainId } = useChainStore();

  const markets = Array.isArray(marketsConfig)
    ? marketsConfig
    : (marketsConfig as any).markets || [];
  const marketConfig = markets.find((m: any) => m.id === marketId);
  const marketAddress = (marketConfig as any)?.contractAddress as `0x${string}`;

  const { data: onChainData, refetch } = useReadContracts({
    contracts: [
      { address: marketAddress, abi: MARKET_V4_ABI, functionName: 'isLive', chainId: Number(selectedChainId) },
      { address: marketAddress, abi: MARKET_V4_ABI, functionName: 'isSettled', chainId: Number(selectedChainId) },
      { address: marketAddress, abi: MARKET_V4_ABI, functionName: 'price', args: [0], chainId: Number(selectedChainId) },
      { address: marketAddress, abi: MARKET_V4_ABI, functionName: 'b', chainId: Number(selectedChainId) },
      { address: marketAddress, abi: MARKET_V4_ABI, functionName: 'qYes', chainId: Number(selectedChainId) },
      { address: marketAddress, abi: MARKET_V4_ABI, functionName: 'qNo', chainId: Number(selectedChainId) },
      { address: marketAddress, abi: MARKET_V4_ABI, functionName: 'feeLMSR', chainId: Number(selectedChainId) },
    ],
    query: {
      enabled: mode === 'real' && !!marketAddress && (marketConfig as any)?.mode !== 'demo',
      refetchInterval: getPollingInterval(walletChainId, 'fast'),
    },
  });

  const [isLive, isSettled, priceYesWad, bParam, qYes, qNo, feeData] =
    onChainData?.map((r) => r.result) || [];

  const configBParam = (marketConfig as any)?.bParam ? BigInt((marketConfig as any).bParam) : 0n;

  const market: Market | undefined = React.useMemo(() => {
    if (!marketConfig) return undefined;

    const priceYesRaw = priceYesWad ? BigInt(priceYesWad as bigint) : undefined;
    const calculatedPriceYes = priceYesRaw ? parseFloat(formatUnits(priceYesRaw, 18)) : undefined;
    const calculatedPriceNo = calculatedPriceYes !== undefined ? 1 - calculatedPriceYes : undefined;

    return {
      ...marketConfig,
      status: isSettled ? 'settled' : isLive === false ? 'cooldown' : 'trading',
      priceYes: calculatedPriceYes,
      priceNo: calculatedPriceNo,
      qYes: (qYes as bigint) || 0n,
      qNo: (qNo as bigint) || 0n,
      bParam: (bParam as bigint) || configBParam || 0n,
      userYesShares: 0,
      userNoShares: 0,
      userYesLocked: 0,
      userNoLocked: 0,
      unlockTime: 0,
      userYesOutcomeTokens: 0,
      userNoOutcomeTokens: 0,
      userAvgEntryYes: null,
      userAvgEntryNo: null,
      mode: 'real',
      fee: feeData ? Number(feeData) / 10000 : 0.005,
    } as Market;
  }, [marketConfig, isSettled, isLive, priceYesWad, bParam, qYes, qNo, configBParam, feeData]);

  React.useEffect(() => {
    if (refreshKey > 0) refetch();
  }, [refreshKey, refetch]);

  return {
    market,
    isLoading: !onChainData && mode === 'real',
    refetch,
  };
}
