import { useAccount, useReadContracts, useChainId } from 'wagmi';
import { useCallback, useMemo } from 'react';
import { LAUNCHPAD_MARKET_ABI, ERC20_ABI } from '../config/abis';
import { useDeployments } from './useDeployments';
import { useLaunchpadMarkets } from './useLaunchpadMarkets';
import { formatUnits } from 'viem';
import { getPollingInterval } from '../lib/polling';

export interface UseLockedFundsResult {
  locked: bigint;
  claimable: bigint;
  available: bigint;
  pending: bigint;
  total: bigint;
  vaultLocked: bigint;
  marketLocked: bigint;
  decimals: number;
  nextUnlockAmount: bigint;
  nextUnlockTimestamp: number;
  entries: LockEntry[];
  lockedFormatted: string;
  claimableFormatted: string;
  availableFormatted: string;
  pendingFormatted: string;
  totalFormatted: string;
  nextUnlockFormatted: string;
  timeRemaining: string;
  isLoading: boolean;
  isClaiming: boolean;
  hasClaimable: boolean;
  claim: () => Promise<void>;
  refetch: () => void;
}

export interface LockEntry {
  amount: bigint;
  unlockTime: number;
  isClaimable: boolean;
  timeRemaining: number;
  marketAddress?: `0x${string}`;
  marketName?: string;
}

export function useLockedFunds(): UseLockedFundsResult {
  const { address } = useAccount();
  const { config } = useDeployments();
  const chainId = useChainId();
  const contracts = config.contracts;
  const { markets, isLoading: marketsLoading } = useLaunchpadMarkets();

  const uniqueMarkets = useMemo(() => {
    const list: { address: `0x${string}`; name: string }[] = [];
    const seen = new Set<string>();

    if (markets) {
      markets.forEach((m) => {
        if (m.address && !seen.has(m.address.toLowerCase())) {
          seen.add(m.address.toLowerCase());
          list.push({ address: m.address, name: m.name });
        }
      });
    }

    return list;
  }, [markets]);

  const marketContracts = useMemo(() => {
    if (!address) return [];

    const calls: any[] = [];
    uniqueMarkets.forEach((market) => {
      calls.push(
        { address: market.address, abi: LAUNCHPAD_MARKET_ABI, functionName: 'lockedBalance', args: [address], chainId },
        { address: market.address, abi: LAUNCHPAD_MARKET_ABI, functionName: 'claimableBalance', args: [address], chainId },
        { address: market.address, abi: LAUNCHPAD_MARKET_ABI, functionName: 'nextUnlock', args: [address], chainId },
        { address: market.address, abi: LAUNCHPAD_MARKET_ABI, functionName: 'getLockEntries', args: [address], chainId }
      );
    });

    return calls;
  }, [address, uniqueMarkets, chainId]);

  const { data: lockData, isLoading: lockDataLoading, refetch } = useReadContracts({
    contracts: [
      ...marketContracts,
      {
        address: contracts?.MockUSDC as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
        chainId,
      },
      { address: contracts?.MockUSDC as `0x${string}`, abi: ERC20_ABI, functionName: 'decimals', chainId },
    ],
    query: {
      enabled: !!address && !!contracts?.MockUSDC,
      refetchInterval: getPollingInterval(chainId, 'slow'),
      staleTime: 10000,
    },
  });

  const aggregated = useMemo(() => {
    let totalLocked = 0n;
    let totalClaimable = 0n;
    let marketLocked = 0n;
    const allEntries: LockEntry[] = [];

    if (!lockData || !address || lockData.length < 2) {
      return {
        locked: 0n,
        claimable: 0n,
        available: 0n,
        pending: 0n,
        total: 0n,
        vaultLocked: 0n,
        marketLocked: 0n,
        nextUnlockAmount: 0n,
        nextUnlockTimestamp: 0,
        entries: [],
        decimals: 6,
      };
    }

    const usdcBalance = (lockData[lockData.length - 2]?.result as bigint) || 0n;
    const assetDecimals = Number(lockData[lockData.length - 1]?.result || 6);

    let cursor = 0;
    const now = Math.floor(Date.now() / 1000);

    uniqueMarkets.forEach((market) => {
      if (cursor + 4 > lockData.length - 2) return;

      const mLocked = (lockData[cursor++]?.result as bigint) || 0n;
      const mClaimable = (lockData[cursor++]?.result as bigint) || 0n;
      cursor++;
      const marketEntries = lockData[cursor++]?.result as [bigint[], bigint[]] | undefined;

      totalLocked += mLocked;
      marketLocked += mLocked;
      totalClaimable += mClaimable;

      if (marketEntries && Array.isArray(marketEntries[0])) {
        marketEntries[0].forEach((amt, i) => {
          const time = Number(marketEntries[1][i]);
          allEntries.push({
            amount: amt,
            unlockTime: time,
            isClaimable: time <= now,
            timeRemaining: Math.max(0, time - now),
            marketAddress: market.address,
            marketName: market.name,
          });
        });
      }
    });

    allEntries.sort((a, b) => a.unlockTime - b.unlockTime);
    const nextEntry = allEntries.find((e) => !e.isClaimable);

    return {
      locked: totalLocked,
      claimable: totalClaimable,
      available: usdcBalance,
      pending: 0n,
      total: usdcBalance + totalLocked,
      vaultLocked: 0n,
      marketLocked,
      nextUnlockAmount: nextEntry?.amount || 0n,
      nextUnlockTimestamp: nextEntry?.unlockTime || 0,
      entries: allEntries,
      decimals: assetDecimals,
    };
  }, [lockData, address, uniqueMarkets]);

  const claim = useCallback(async () => {}, []);

  const formatUSD = (value: bigint) => {
    const num = parseFloat(formatUnits(value, aggregated.decimals));
    return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  };

  const lockedFormatted = formatUSD(aggregated.locked);
  const claimableFormatted = formatUSD(aggregated.claimable);
  const availableFormatted = formatUSD(aggregated.available);
  const pendingFormatted = formatUSD(aggregated.pending);
  const totalFormatted = formatUSD(aggregated.total);
  const nextUnlockFormatted = formatUSD(aggregated.nextUnlockAmount);

  const nowSeconds = Math.floor(Date.now() / 1000);
  const secondsRemaining = Math.max(0, aggregated.nextUnlockTimestamp - nowSeconds);
  const timeRemaining =
    secondsRemaining <= 0
      ? 'Ready'
      : `${Math.floor(secondsRemaining / 3600)}h ${Math.floor((secondsRemaining % 3600) / 60)}m`;

  return useMemo(
    () => ({
      ...aggregated,
      lockedFormatted,
      claimableFormatted,
      availableFormatted,
      pendingFormatted,
      totalFormatted,
      nextUnlockFormatted,
      timeRemaining,
      isLoading: marketsLoading || lockDataLoading,
      isClaiming: false,
      hasClaimable: aggregated.claimable > 0n,
      claim,
      refetch,
    }),
    [
      aggregated,
      lockedFormatted,
      claimableFormatted,
      availableFormatted,
      pendingFormatted,
      totalFormatted,
      nextUnlockFormatted,
      timeRemaining,
      marketsLoading,
      lockDataLoading,
      claim,
      refetch,
    ]
  );
}
