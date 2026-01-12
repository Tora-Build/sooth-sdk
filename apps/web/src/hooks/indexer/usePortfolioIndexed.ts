import { useQuery } from "@tanstack/react-query";
import { useChainStore } from "../../store/useChainStore";
import { fetchFromIndexer, checkChainReady, USE_INDEXER } from "./config";
import { addJitter } from "../../lib/polling";

type Address = `0x${string}`;

export interface VaultBalanceIndexed {
  id: string;
  chainId: number;
  user: string;
  availableUsdcWad: string;
  reservedUsdcWad: string;
  updatedAt: string;
}

export interface VaultPositionIndexed {
  id: string;
  chainId: number;
  market: string;
  user: string;
  yesSharesWad: string;
  noSharesWad: string;
  updatedAt: string;
}

export interface AmmPositionIndexed {
  id: string;
  chainId: number;
  market: string;
  user: string;
  yesShares: string;
  noShares: string;
  updatedAt: string;
}

export interface LpBalanceIndexed {
  id: string;
  chainId: number;
  market: string;
  user: string;
  balance: string;
  updatedAt: string;
}

export interface LockEntryIndexed {
  id: string;
  chainId: number;
  user: string;
  market: string;
  amountWad: string;
  unlockTime: string;
  claimed: boolean;
  createdAt: string;
}

export interface PortfolioData {
  vaultBalance: VaultBalanceIndexed | null;
  vaultPositions: VaultPositionIndexed[];
  ammPositions: AmmPositionIndexed[];
  lpBalances: LpBalanceIndexed[];
  lockEntries: LockEntryIndexed[];
}

export function usePortfolioIndexed(userAddress: Address | undefined) {
  const { selectedChainId } = useChainStore();
  const chainId = typeof selectedChainId === "number" ? selectedChainId : Number(selectedChainId);

  const chainReadyQuery = useQuery({
    queryKey: ["indexer", "chainReady", chainId],
    enabled: USE_INDEXER && !!chainId,
    queryFn: () => checkChainReady(chainId),
    staleTime: 10_000,
    refetchInterval: addJitter(30_000),
  });

  const isChainReady = chainReadyQuery.data === true;

  const portfolioQuery = useQuery({
    queryKey: ["indexer", "portfolio", chainId, userAddress],
    enabled: USE_INDEXER && isChainReady && !!userAddress && !!chainId,
    queryFn: async () => {
      const data = await fetchFromIndexer<PortfolioData>(
        `/portfolio/${chainId}/${userAddress}`
      );
      return data;
    },
    staleTime: 5_000,
    refetchInterval: addJitter(10_000),
    retry: false,
  });

  const hasData = USE_INDEXER && isChainReady && !!portfolioQuery.data;

  return {
    data: portfolioQuery.data ?? null,
    vaultBalance: portfolioQuery.data?.vaultBalance ?? null,
    vaultPositions: portfolioQuery.data?.vaultPositions ?? [],
    ammPositions: portfolioQuery.data?.ammPositions ?? [],
    lpBalances: portfolioQuery.data?.lpBalances ?? [],
    lockEntries: portfolioQuery.data?.lockEntries ?? [],
    isLoading: portfolioQuery.isLoading || chainReadyQuery.isLoading,
    error: portfolioQuery.error,
    refetch: portfolioQuery.refetch,
    isIndexerReady: hasData,
    source: hasData ? ("indexer" as const) : ("rpc" as const),
  };
}

export function useVaultBalanceIndexed(userAddress: Address | undefined) {
  const { selectedChainId } = useChainStore();
  const chainId = typeof selectedChainId === "number" ? selectedChainId : Number(selectedChainId);

  const chainReadyQuery = useQuery({
    queryKey: ["indexer", "chainReady", chainId],
    enabled: USE_INDEXER && !!chainId,
    queryFn: () => checkChainReady(chainId),
    staleTime: 10_000,
    refetchInterval: addJitter(30_000),
  });

  const isChainReady = chainReadyQuery.data === true;

  const query = useQuery({
    queryKey: ["indexer", "vaultBalance", chainId, userAddress],
    enabled: USE_INDEXER && isChainReady && !!userAddress && !!chainId,
    queryFn: async () => {
      const data = await fetchFromIndexer<VaultBalanceIndexed>(
        `/vault-balance/${chainId}/${userAddress}`
      );
      return data;
    },
    staleTime: 5_000,
    refetchInterval: addJitter(10_000),
    retry: false,
  });

  return {
    vaultBalance: query.data ?? null,
    availableUsdcWad: query.data?.availableUsdcWad ? BigInt(query.data.availableUsdcWad) : 0n,
    reservedUsdcWad: query.data?.reservedUsdcWad ? BigInt(query.data.reservedUsdcWad) : 0n,
    isLoading: query.isLoading || chainReadyQuery.isLoading,
    error: query.error,
    refetch: query.refetch,
    isIndexerReady: USE_INDEXER && isChainReady && !!query.data,
  };
}

export function useVaultPositionsIndexed(userAddress: Address | undefined) {
  const { selectedChainId } = useChainStore();
  const chainId = typeof selectedChainId === "number" ? selectedChainId : Number(selectedChainId);

  const chainReadyQuery = useQuery({
    queryKey: ["indexer", "chainReady", chainId],
    enabled: USE_INDEXER && !!chainId,
    queryFn: () => checkChainReady(chainId),
    staleTime: 10_000,
    refetchInterval: addJitter(30_000),
  });

  const isChainReady = chainReadyQuery.data === true;

  const query = useQuery({
    queryKey: ["indexer", "vaultPositions", chainId, userAddress],
    enabled: USE_INDEXER && isChainReady && !!userAddress && !!chainId,
    queryFn: async () => {
      const data = await fetchFromIndexer<VaultPositionIndexed[]>(
        `/vault-positions/${chainId}/${userAddress}`
      );
      return data ?? [];
    },
    staleTime: 5_000,
    refetchInterval: addJitter(10_000),
    retry: false,
  });

  return {
    positions: query.data ?? [],
    isLoading: query.isLoading || chainReadyQuery.isLoading,
    error: query.error,
    refetch: query.refetch,
    isIndexerReady: USE_INDEXER && isChainReady,
  };
}
