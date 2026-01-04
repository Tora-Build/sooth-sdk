import { useQuery } from "@tanstack/react-query";
import { useChainStore } from "../../store/useChainStore";
import { fetchFromIndexer, checkChainReady, USE_INDEXER } from "./config";

interface IndexedTrade {
  id: string;
  chainId: number;
  marketKey: string;
  taker: string;
  outcome: number;
  sharesRequested: string;
  sharesFilled: string;
  totalCost: string;
  startTick: number;
  endTick: number;
  refunded: string;
  timestamp: string;
  blockNumber: string;
  txHash: string;
}

export interface Trade {
  id: string;
  taker: `0x${string}`;
  outcome: number;
  sharesFilled: bigint;
  totalCost: bigint;
  avgPrice: number; // Derived: totalCost / sharesFilled
  timestamp: bigint;
  txHash: `0x${string}`;
}

/**
 * Hook to fetch recent trades for a market (per-chain readiness)
 * Only available via indexer (no RPC equivalent)
 */
export function useTradesIndexed(
  marketKey: `0x${string}` | undefined,
  limit: number = 50
) {
  const { selectedChainId } = useChainStore();
  const chainId = typeof selectedChainId === "number" ? selectedChainId : Number(selectedChainId);

  // Check if this specific chain is ready
  const chainReadyQuery = useQuery({
    queryKey: ["indexer", "chainReady", chainId],
    enabled: USE_INDEXER && !!chainId,
    queryFn: () => checkChainReady(chainId),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  const isChainReady = chainReadyQuery.data === true;

  const query = useQuery({
    queryKey: ["indexer", "trades", chainId, marketKey, limit],
    enabled: USE_INDEXER && isChainReady && !!marketKey && !!chainId,
    queryFn: async () => {
      const data = await fetchFromIndexer<IndexedTrade[]>(
        `/trades/${chainId}/${marketKey}?limit=${limit}`
      );
      if (!data) return [];

      return data.map((t): Trade => {
        const sharesFilled = BigInt(t.sharesFilled);
        const totalCost = BigInt(t.totalCost);
        const avgPrice = sharesFilled > 0n
          ? Number(totalCost * 10000n / sharesFilled) / 10000
          : 0;

        return {
          id: t.id,
          taker: t.taker as `0x${string}`,
          outcome: t.outcome,
          sharesFilled,
          totalCost,
          avgPrice,
          timestamp: BigInt(t.timestamp),
          txHash: t.txHash as `0x${string}`,
        };
      });
    },
    staleTime: 5_000,
    refetchInterval: 10_000,
  });

  return {
    trades: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    isChainReady,
  };
}
