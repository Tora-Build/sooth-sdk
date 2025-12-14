import React from 'react';
import { useReadContracts, useAccount, useChainId } from 'wagmi';
import { formatUnits } from 'viem';
import { MARKET_V4_ABI, TRADER_VAULT_V4_ABI } from '../config/abis';
import { useDeployments } from './useDeployments';
import marketsConfig from '../config/markets.json';
import { Market } from '../types';
import { useChainStore } from '../store/useChainStore';
import { useMarketStore } from '../store/useMarketStore';

export function useAmmMarket(marketId: string) {
  return useEVMMarket(marketId);
}

function useEVMMarket(marketId: string) {
  const { address } = useAccount();
  const walletChainId = useChainId();
  const { mode, refreshKey, markets: demoMarkets } = useMarketStore();
  const { selectedChainId } = useChainStore();
  const { config } = useDeployments();
  const deployments = config.contracts;

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
      { address: marketAddress, abi: MARKET_V4_ABI, functionName: 'qYes' },
      { address: marketAddress, abi: MARKET_V4_ABI, functionName: 'qNo' },
      { address: marketAddress, abi: MARKET_V4_ABI, functionName: 'feeLMSR' },
      // V4: AMM positions (TraderVault)
      {
        address: traderVaultAddress,
        abi: TRADER_VAULT_V4_ABI,
        functionName: 'ammPositions',
        args: [address || '0x0000000000000000000000000000000000000000', marketAddress]
      }
    ],
    query: {
      // Relaxed check: Fetch if real mode and we have a valid market address.
      // Removed walletChainId === selectedChainId to match PortfolioSummary behavior.
      // Fix: Don't fetch for demo markets (which have dummy addresses) even if mode is real
      enabled: mode === 'real' && !!marketAddress && (marketConfig as any)?.mode !== 'demo',
      refetchInterval: 3000,
    }
  });

  // Debug Logs
  if (mode === 'real' && !onChainData && !isHookLoading) {
    console.log('UseMarket: Addresses', { traderVaultAddress, marketAddress, outcomeTokenAddr: (marketConfig as any)?.outcomeTokenAddress });
  }

  // 3. Process Data
  const [isLive, isSettled, priceYesWad, bParam, qYes, qNo, feeData, ammPosition] = onChainData?.map(r => r.result) || [];

  const configBParam = (marketConfig as any)?.bParam ? BigInt((marketConfig as any).bParam) : 0n;

  // Extract AMM position - V4.6: only 2 fields (yesShares, noShares) - no unlockTime
  const ammPos = ammPosition as [bigint, bigint] | undefined;
  const ammYesShares = ammPos?.[0] || 0n;
  const ammNoShares = ammPos?.[1] || 0n;
  const ammUnlockTime = 0n; // V4.6 Lock-on-Sell: always 0

  // Real Mode Construction
  const market: Market | undefined = React.useMemo(() => {
    // Advanced Debug Logging
    if (mode === 'real') {
      const ammResult = onChainData?.[7]; // Index 7 is ammPositions
      if (ammResult?.status === 'failure') {
        console.error('UseMarket: AMM Position Fetch Failed', {
          error: ammResult.error,
          vaultAddress: traderVaultAddress,
          marketAddress,
          user: address
        });
      } else if (ammResult?.result) {
        // console.log('UseMarket: AMM Position Success', ammResult.result);
      }
    }

    if (!marketConfig) return undefined;

    // V4 Continuous LMSR: price(0) returns YES probability in 18 decimals
    const priceYesRaw = priceYesWad ? BigInt(priceYesWad as bigint) : undefined;

    // If price fetch failed, return undefined to show loading/error state instead of 0.5
    const calculatedPriceYes = priceYesRaw ? parseFloat(formatUnits(priceYesRaw, 18)) : undefined;
    const calculatedPriceNo = calculatedPriceYes !== undefined ? 1 - calculatedPriceYes : undefined;

    return {
      ...marketConfig,
      status: isSettled ? 'settled' : (isLive === false ? 'cooldown' : 'trading'),
      priceYes: calculatedPriceYes, // Can be undefined
      priceNo: calculatedPriceNo,
      qYes: (qYes as bigint) || 0n,
      qNo: (qNo as bigint) || 0n,
      bParam: (bParam as bigint) || configBParam || 0n,
      userYesShares: parseFloat(formatUnits(ammYesShares, 18)),
      userNoShares: parseFloat(formatUnits(ammNoShares, 18)),

      // Breakdown for Locked Shares Logic
      userYesLocked: parseFloat(formatUnits(ammYesShares, 18)),
      userNoLocked: parseFloat(formatUnits(ammNoShares, 18)),
      unlockTime: Number(ammUnlockTime),

      // Orderbook tokens handled in useOrderbook now
      userYesOutcomeTokens: 0,
      userNoOutcomeTokens: 0,
      userAvgEntryYes: null,
      userAvgEntryNo: null,
      mode: 'real',
      fee: feeData ? Number(feeData) / 10000 : 0.005, // Default to 0.5% if missing
    } as Market;
  }, [marketConfig, isSettled, isLive, priceYesWad, bParam, qYes, qNo, configBParam, ammYesShares, ammNoShares, ammUnlockTime, feeData]);

  // React to global refresh events
  React.useEffect(() => {
    if (refreshKey > 0) refetch();
  }, [refreshKey, refetch]);

  return {
    market,
    isLoading: !onChainData && mode === 'real',
    refetch,
  };
}

