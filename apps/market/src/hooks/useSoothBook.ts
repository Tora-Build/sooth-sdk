import { useMemo } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { type Address, encodePacked, keccak256, isAddress } from 'viem';
import { SOOTH_BOOK_ABI } from '../config/abis';
import { getDeployment } from '../config/deployments';
import { DEFAULT_CHAIN_ID } from '../config/chains';

// ── useSoothBookMarket ────────────────────────────────────────────────────

export function useSoothBookMarket(marketAddress?: string, instanceSoothBook?: string) {
  const fallback = getDeployment(DEFAULT_CHAIN_ID)?.SoothBook;
  const soothBookAddress = (instanceSoothBook ?? fallback) as Address | undefined;

  const marketKey = useMemo(() => {
    if (!marketAddress || !isAddress(marketAddress)) return undefined;
    return keccak256(encodePacked(['address'], [marketAddress as Address]));
  }, [marketAddress]);

  const canRead = !!soothBookAddress && !!marketKey;

  // markets(marketKey) → [collateral, yesToken, noToken, active, finalized, outcome]
  const { data: marketTuple, isLoading } = useReadContract({
    address: soothBookAddress,
    abi: SOOTH_BOOK_ABI,
    functionName: 'markets',
    args: marketKey ? [marketKey] : undefined,
    query: { enabled: canRead },
  });

  // getBestTick(marketKey, 1) → best YES buy tick
  const { data: bestYesTick } = useReadContract({
    address: soothBookAddress,
    abi: SOOTH_BOOK_ABI,
    functionName: 'getBestTick',
    args: marketKey ? [marketKey, 1] : undefined,
    query: { enabled: canRead, refetchInterval: 10_000 },
  });

  // getBestTick(marketKey, 0) → best NO buy tick
  const { data: bestNoTick } = useReadContract({
    address: soothBookAddress,
    abi: SOOTH_BOOK_ABI,
    functionName: 'getBestTick',
    args: marketKey ? [marketKey, 0] : undefined,
    query: { enabled: canRead, refetchInterval: 10_000 },
  });

  // getImpliedPrice(marketKey) → [yesPrice, noPrice]
  const { data: implied } = useReadContract({
    address: soothBookAddress,
    abi: SOOTH_BOOK_ABI,
    functionName: 'getImpliedPrice',
    args: marketKey ? [marketKey] : undefined,
    query: { enabled: canRead, refetchInterval: 10_000 },
  });

  return {
    collateral: marketTuple?.[0] as Address | undefined,
    yesToken: marketTuple?.[1] as Address | undefined,
    noToken: marketTuple?.[2] as Address | undefined,
    isActive: Boolean(marketTuple?.[3]),
    isFinalized: Boolean(marketTuple?.[4]),
    outcome: Number(marketTuple?.[5] ?? 0),
    bestYesTick: bestYesTick != null ? Number(bestYesTick) : undefined,
    bestNoTick: bestNoTick != null ? Number(bestNoTick) : undefined,
    yesPrice: implied?.[0] as bigint | undefined,
    noPrice: implied?.[1] as bigint | undefined,
    isLoading,
    marketKey,
  };
}

// ── useSoothBookBalance ───────────────────────────────────────────────────

export function useSoothBookBalance(marketAddress?: string, instanceSoothBook?: string) {
  const { address: userAddress } = useAccount();
  const fallback = getDeployment(DEFAULT_CHAIN_ID)?.SoothBook;
  const soothBookAddress = (instanceSoothBook ?? fallback) as Address | undefined;

  const marketKey = useMemo(() => {
    if (!marketAddress || !isAddress(marketAddress)) return undefined;
    return keccak256(encodePacked(['address'], [marketAddress as Address]));
  }, [marketAddress]);

  const canRead = !!soothBookAddress && !!marketKey && !!userAddress;

  // getBalance(marketKey, user) → [yesTokenBalance, noTokenBalance]
  const { data: balanceTuple, isLoading } = useReadContract({
    address: soothBookAddress,
    abi: SOOTH_BOOK_ABI,
    functionName: 'getBalance',
    args: marketKey && userAddress ? [marketKey, userAddress] : undefined,
    query: { enabled: canRead, refetchInterval: 10_000 },
  });

  return {
    yesShares: balanceTuple?.[0] as bigint | undefined,
    noShares: balanceTuple?.[1] as bigint | undefined,
    yesEscrow: undefined as bigint | undefined,
    noEscrow: undefined as bigint | undefined,
    isLoading,
  };
}
