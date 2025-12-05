import React from 'react';
import { useReadContracts, useAccount, useChainId } from 'wagmi';
import { formatUnits } from 'viem';
import { SOOTH_MARKET_ABI, SOOTH_BALANCED_AMM_ABI } from '../config/abis';
import { useDeployments } from './useDeployments';
import marketsConfig from '../config/markets.json';
import { Market } from '../types';
import { useMarketStore } from '../store/useMarketStore';
import { useChainStore } from '../store/useChainStore';

export function useMarket(marketId: string) {
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
  const { data: onChainData, refetch } = useReadContracts({
    contracts: [
      { address: marketAddress, abi: SOOTH_MARKET_ABI, functionName: 'isLive' },
      { address: marketAddress, abi: SOOTH_MARKET_ABI, functionName: 'isSettled' },
      { address: marketAddress, abi: SOOTH_MARKET_ABI, functionName: 'ammState' },
      { address: marketAddress, abi: SOOTH_MARKET_ABI, functionName: 'b' }, // v3: bParam is in Market contract
      { address: marketAddress, abi: SOOTH_MARKET_ABI, functionName: 'yesBalance', args: [address || '0x0'] },
      { address: marketAddress, abi: SOOTH_MARKET_ABI, functionName: 'noBalance', args: [address || '0x0'] },
    ],
    query: {
      enabled: mode === 'real' && !!marketAddress && walletChainId === selectedChainId,
      refetchInterval: 5000,
    }
  });

  // 3. Price Calculation (LMSR) - Dependent on AMM State
  const [isLive, isSettled, ammState, bParam, yesBal, noBal] = onChainData?.map(r => r.result) || [];
  
  // Parse ammState tuple [qYes, qNo]  
  const parsedQYes = ammState ? (ammState as any)[0] : undefined;
  const parsedQNo = ammState ? (ammState as any)[1] : undefined;


  
  const { data: prices } = useReadContracts({
    contracts: [
      { 
        address: ammAddress, 
        abi: SOOTH_BALANCED_AMM_ABI, 
        functionName: 'price', 
        args: [ammState as any, 0, bParam as bigint] 
      },
      { 
        address: ammAddress, 
        abi: SOOTH_BALANCED_AMM_ABI, 
        functionName: 'price', 
        args: [ammState as any, 1, bParam as bigint] 
      },
    ],
    query: {
      enabled: mode === 'real' && !!ammState && !!bParam,
    }
  });

  // 4. Return Data based on Mode
  if (mode === 'demo') {
    const demoMarket = demoMarkets.find(m => m.id === marketId);
    return {
      market: demoMarket,
      isLoading: false,
      refetch: () => {},
    };
  }

  // Parse ammState tuple [qYes, qNo]
  const qYes = ammState ? (ammState as any)[0] : 0n;
  const qNo = ammState ? (ammState as any)[1] : 0n;

  // Parse bParam from config (string -> bigint)
  const configBParam = (marketConfig as any)?.bParam ? BigInt((marketConfig as any).bParam) : 0n;

  // Real Mode Construction
  const market: Market | undefined = React.useMemo(() => {
    if (!marketConfig) return undefined;
    return {
      ...marketConfig,
      status: isSettled ? 'settled' : (isLive ? 'trading' : 'cooldown'), // Simplified status mapping
      priceYes: prices?.[0].result ? parseFloat(formatUnits(prices[0].result as bigint, 18)) : 0.5,
      priceNo: prices?.[1].result ? parseFloat(formatUnits(prices[1].result as bigint, 18)) : 0.5,
      qYes,
      qNo,
      bParam: (bParam as bigint) || configBParam || 0n,
      userYesShares: yesBal ? parseFloat(formatUnits(yesBal as bigint, 18)) : 0,
      userNoShares: noBal ? parseFloat(formatUnits(noBal as bigint, 18)) : 0,
      userAvgEntryYes: null, // Not tracked on-chain easily
      userAvgEntryNo: null,
      mode: 'real',
    } as Market;
  }, [marketConfig, isSettled, isLive, prices, qYes, qNo, bParam, configBParam, yesBal, noBal]);

  return {
    market,
    isLoading: !onChainData && mode === 'real',
    refetch,
  };
}
