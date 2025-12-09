import React from 'react';
import { useReadContracts, useAccount, useChainId } from 'wagmi';
import { formatUnits } from 'viem';
import { MARKET_V4_ABI, TRADER_VAULT_V4_ABI } from '../config/abis';
import { useDeployments } from './useDeployments';
import marketsConfig from '../config/markets.json';
import { Market } from '../types';
import { useChainStore } from '../store/useChainStore';
import { useMarketStore } from '../store/useMarketStore';

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
  const traderVaultAddress = deployments.SoothTraderVault as `0x${string}`;

  // 2. On-Chain Data Fetching (Only if Real Mode AND on correct chain)
  const { data: onChainData, refetch, isLoading: isHookLoading, error: hookError } = useReadContracts({
    contracts: [
      { address: marketAddress, abi: MARKET_V4_ABI, functionName: 'isLive' },
      { address: marketAddress, abi: MARKET_V4_ABI, functionName: 'isSettled' },
      { address: marketAddress, abi: MARKET_V4_ABI, functionName: 'price', args: [0] }, // V4: fetch price(0) for YES probability
      { address: marketAddress, abi: MARKET_V4_ABI, functionName: 'b' },
      // V4: AMM positions are in TraderVault, not Market
      {
        address: traderVaultAddress,
        abi: TRADER_VAULT_V4_ABI,
        functionName: 'ammPositions',
        args: address && marketAddress ? [address, marketAddress] : undefined
      },
    ],
    query: {
      enabled: mode === 'real' && !!marketAddress && walletChainId === selectedChainId,
      refetchInterval: 5000,
    }
  });

  // 3. Process Data
  const [isLive, isSettled, priceYesWad, bParam, ammPosition] = onChainData?.map(r => r.result) || [];

  const configBParam = (marketConfig as any)?.bParam ? BigInt((marketConfig as any).bParam) : 0n;

  // Extract AMM position (yesShares, noShares, unlockTime)
  const ammPos = ammPosition as [bigint, bigint, bigint] | undefined;
  const ammYesShares = ammPos?.[0] || 0n;
  const ammNoShares = ammPos?.[1] || 0n;

  // Real Mode Construction
  const market: Market | undefined = React.useMemo(() => {
    if (!marketConfig) return undefined;

    // V4 Continuous LMSR: price(0) returns YES probability in 18 decimals
    const priceYesRaw = priceYesWad ? BigInt(priceYesWad as bigint) : 500000000000000000n; // default 0.5
    const calculatedPriceYes = parseFloat(formatUnits(priceYesRaw, 18));
    const calculatedPriceNo = 1 - calculatedPriceYes;

    return {
      ...marketConfig,
      status: isSettled ? 'settled' : (isLive === false ? 'cooldown' : 'trading'),
      priceYes: calculatedPriceYes,
      priceNo: calculatedPriceNo,
      qYes: 0n, // V4 continuous LMSR uses internal qYes/qNo state
      qNo: 0n,
      bParam: (bParam as bigint) || configBParam || 0n,
      // V4: User shares from TraderVault.ammPositions
      userYesShares: parseFloat(formatUnits(ammYesShares, 18)),
      userNoShares: parseFloat(formatUnits(ammNoShares, 18)),
      userAvgEntryYes: null,
      userAvgEntryNo: null,
      mode: 'real',
    } as Market;
  }, [marketConfig, isSettled, isLive, priceYesWad, bParam, configBParam, ammYesShares, ammNoShares]);

  return {
    market,
    isLoading: !onChainData && mode === 'real',
    refetch,
  };
}

