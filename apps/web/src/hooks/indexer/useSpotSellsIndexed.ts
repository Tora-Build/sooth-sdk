import { useQuery } from "@tanstack/react-query";
import { useChainStore } from "../../store/useChainStore";
import { fetchFromIndexer, checkChainReady, USE_INDEXER } from "./config";

type Address = `0x${string}`;

export interface SpotSellOrderIndexed {
  sellId: bigint;
  owner: Address;
  outcome: 0 | 1;
  tickLower: number;
  tickUpper: number;
  sharesTotal: bigint;
  sharesFilled: bigint;
  active: boolean;
}

interface IndexedSpotSellOrder {
  id: string;
  chainId: number;
  sellId: string;
  marketKey: string;
  owner: string;
  outcome: number;
  tickLower: number;
  tickUpper: number;
  shares: string;
  status: string;
  filledShares: string;
}

export function useSpotSellsIndexed(marketKey: `0x${string}` | undefined) {
  const { selectedChainId } = useChainStore();
  const chainId = typeof selectedChainId === "number" ? selectedChainId : Number(selectedChainId);

  const chainReadyQuery = useQuery({
    queryKey: ["indexer", "chainReady", chainId],
    enabled: USE_INDEXER && !!chainId,
    queryFn: () => checkChainReady(chainId),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  const isChainReady = chainReadyQuery.data === true;

  const query = useQuery({
    queryKey: ["indexer", "spotSells", chainId, marketKey],
    enabled: USE_INDEXER && isChainReady && !!marketKey && !!chainId,
    queryFn: async () => {
      const data = await fetchFromIndexer<IndexedSpotSellOrder[]>(
        `/spotsells/${chainId}/${marketKey}`
      );
      if (!data) return [];

      return data.map((o) => ({
        sellId: BigInt(o.sellId),
        owner: o.owner.toLowerCase() as Address,
        outcome: (o.outcome === 1 ? 1 : 0) as 0 | 1,
        tickLower: o.tickLower,
        tickUpper: o.tickUpper,
        sharesTotal: BigInt(o.shares),
        sharesFilled: BigInt(o.filledShares ?? "0"),
        active: o.status === "active",
      }));
    },
    staleTime: 5_000,
    refetchInterval: 10_000,
    retry: false,
  });

  return {
    spotSells: query.data ?? [],
    isLoading: query.isLoading || chainReadyQuery.isLoading,
    error: query.error ?? chainReadyQuery.error,
    refetch: query.refetch,
    source: isChainReady ? ("indexer" as const) : ("none" as const),
    isChainReady,
  };
}
