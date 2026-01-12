import { useQuery } from "@tanstack/react-query";
import { useChainStore } from "../../store/useChainStore";
import { fetchFromIndexer, checkChainReady, USE_INDEXER } from "./config";
import { addJitter } from "../../lib/polling";

type Address = `0x${string}`;

export interface LaunchpadMarketIndexed {
  address: string;
  chainId: number;
  creator: string;
  initialLiquidity: string;
  deposit: string;
  totalLPSupply: string;
  isGraduated: boolean;
  createdAt: string;
  graduatedAt: string | null;
  blockNumber: string;
}

export function useMarketsIndexed() {
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

  const marketsQuery = useQuery({
    queryKey: ["indexer", "launchpadMarkets", chainId],
    enabled: USE_INDEXER && isChainReady && !!chainId,
    queryFn: async () => {
      const data = await fetchFromIndexer<LaunchpadMarketIndexed[]>(
        `/launchpad-markets/${chainId}`
      );
      return data ?? [];
    },
    staleTime: 15_000,
    refetchInterval: addJitter(30_000),
    retry: false,
  });

  const hasData = USE_INDEXER && isChainReady && (marketsQuery.data?.length ?? 0) > 0;

  return {
    markets: marketsQuery.data ?? [],
    marketCount: marketsQuery.data?.length ?? 0,
    isLoading: marketsQuery.isLoading || chainReadyQuery.isLoading,
    error: marketsQuery.error,
    refetch: marketsQuery.refetch,
    isIndexerReady: hasData,
    source: hasData ? ("indexer" as const) : ("rpc" as const),
  };
}

export function useLpBalancesIndexed(userAddress: Address | undefined) {
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
    queryKey: ["indexer", "lpBalances", chainId, userAddress],
    enabled: USE_INDEXER && isChainReady && !!userAddress && !!chainId,
    queryFn: async () => {
      const data = await fetchFromIndexer<Array<{
        id: string;
        chainId: number;
        market: string;
        user: string;
        balance: string;
        updatedAt: string;
      }>>(`/lp-balances/${chainId}/${userAddress}`);
      return data ?? [];
    },
    staleTime: 5_000,
    refetchInterval: addJitter(10_000),
    retry: false,
  });

  return {
    lpBalances: query.data ?? [],
    isLoading: query.isLoading || chainReadyQuery.isLoading,
    error: query.error,
    refetch: query.refetch,
    isIndexerReady: USE_INDEXER && isChainReady,
  };
}

export function useAmmPositionsIndexed(userAddress: Address | undefined) {
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
    queryKey: ["indexer", "ammPositions", chainId, userAddress],
    enabled: USE_INDEXER && isChainReady && !!userAddress && !!chainId,
    queryFn: async () => {
      const data = await fetchFromIndexer<Array<{
        id: string;
        chainId: number;
        market: string;
        user: string;
        yesShares: string;
        noShares: string;
        updatedAt: string;
      }>>(`/amm-positions/${chainId}/${userAddress}`);
      return data ?? [];
    },
    staleTime: 5_000,
    refetchInterval: addJitter(10_000),
    retry: false,
  });

  return {
    ammPositions: query.data ?? [],
    isLoading: query.isLoading || chainReadyQuery.isLoading,
    error: query.error,
    refetch: query.refetch,
    isIndexerReady: USE_INDEXER && isChainReady,
  };
}

export function useLockEntriesIndexed(userAddress: Address | undefined) {
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
    queryKey: ["indexer", "lockEntries", chainId, userAddress],
    enabled: USE_INDEXER && isChainReady && !!userAddress && !!chainId,
    queryFn: async () => {
      const data = await fetchFromIndexer<Array<{
        id: string;
        chainId: number;
        user: string;
        market: string;
        amountWad: string;
        unlockTime: string;
        claimed: boolean;
        createdAt: string;
      }>>(`/lock-entries/${chainId}/${userAddress}`);
      return data ?? [];
    },
    staleTime: 5_000,
    refetchInterval: addJitter(10_000),
    retry: false,
  });

  return {
    lockEntries: query.data ?? [],
    isLoading: query.isLoading || chainReadyQuery.isLoading,
    error: query.error,
    refetch: query.refetch,
    isIndexerReady: USE_INDEXER && isChainReady,
  };
}
