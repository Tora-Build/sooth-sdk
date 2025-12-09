import React from 'react';
import { useReadContracts, useAccount, useChainId } from 'wagmi';
import { formatUnits } from 'viem';
import { MARKET_V4_ABI } from '../config/abis';
import { useDeployments } from './useDeployments';
import marketsConfig from '../config/markets.json';
import { Market } from '../types';
import { useChainStore } from '../store/useChainStore';
import { useMarketStore } from '../store/useMarketStore'; // Assuming this was implicitly needed for useMarketStore

export function useMarket(marketId: string) {
  return useEVMMarket(marketId);
}

function useEVMMarket(marketId: string) {
  const { address } = useAccount();
  const walletChainId = useChainId();
  const { mode, markets: demoMarkets } = useMarketStore();
  const { selectedChainId } = useChainStore();
  const deployments = useDeployments();

  // 1. Config Lookup
  const marketConfig = marketsConfig.markets.find(m => m.id === marketId);
  const marketAddress = (marketConfig as any)?.contractAddress as `0x${string}`;
  const ammAddress = deployments.AMM as `0x${string}`;
  const riskManagerAddress = deployments.SoothRiskManager as `0x${string}`;

  // 2. On-Chain Data Fetching (Only if Real Mode AND on correct chain)
  const { data: onChainData, refetch, isLoading: isHookLoading, error: hookError } = useReadContracts({
    contracts: [
      { address: marketAddress, abi: MARKET_V4_ABI, functionName: 'isLive' },
      { address: marketAddress, abi: MARKET_V4_ABI, functionName: 'isSettled' },
      { address: marketAddress, abi: MARKET_V4_ABI, functionName: 'currentTick' },
      { address: marketAddress, abi: MARKET_V4_ABI, functionName: 'b' },
      { address: marketAddress, abi: MARKET_V4_ABI, functionName: 'yesBalance', args: [address || '0x0'] },
      { address: marketAddress, abi: MARKET_V4_ABI, functionName: 'noBalance', args: [address || '0x0'] },
    ],
    query: {
      enabled: mode === 'real' && !!marketAddress && walletChainId === selectedChainId,
      refetchInterval: 5000,
    }
  });

  // 3. Process Data
  const [isLive, isSettled, currentTick, bParam, yesBal, noBal] = onChainData?.map(r => r.result) || [];

  const configBParam = (marketConfig as any)?.bParam ? BigInt((marketConfig as any).bParam) : 0n;

  // Real Mode Construction
  const market: Market | undefined = React.useMemo(() => {
    if (!marketConfig) return undefined;

    // V4 Price Calculation: probability = tick / 1000
    const tickVal = currentTick ? Number(currentTick) : 500; // default 0.5
    const calculatedPriceYes = tickVal / 1000;
    const calculatedPriceNo = 1 - calculatedPriceYes;

    return {
      ...marketConfig,
      status: isSettled ? 'settled' : (isLive === false ? 'cooldown' : 'trading'),
      priceYes: calculatedPriceYes,
      priceNo: calculatedPriceNo,
      qYes: 0n, // V4 doesn't use qYes/qNo
      qNo: 0n,
      bParam: (bParam as bigint) || configBParam || 0n,
      userYesShares: yesBal ? parseFloat(formatUnits(yesBal as bigint, 18)) : 0,
      userNoShares: noBal ? parseFloat(formatUnits(noBal as bigint, 18)) : 0,
      userAvgEntryYes: null,
      userAvgEntryNo: null,
      mode: 'real',
    } as Market;
  }, [marketConfig, isSettled, isLive, currentTick, bParam, configBParam, yesBal, noBal]);

  return {
    market,
    isLoading: !onChainData && mode === 'real',
    refetch,
  };
}
