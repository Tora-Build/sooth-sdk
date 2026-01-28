import { useQuery } from "@tanstack/react-query";
import { useChainStore } from "../../store/useChainStore";
import { usePublicClient, useAccount } from "wagmi";
import { fetchFromIndexer, checkChainReady, USE_INDEXER } from "./config";
import { useDeployments } from "../useDeployments";
import { ABIS } from "../../config/abis";
import { addJitter } from "../../lib/polling";

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
  const { address: userAddress } = useAccount();
  const deployments = useDeployments();
  const tickBookManagerAddress = deployments?.contracts?.TickBookPoolManager as Address | undefined;
  const publicClient = usePublicClient({ chainId });

  const chainReadyQuery = useQuery({
    queryKey: ["indexer", "chainReady", chainId],
    enabled: USE_INDEXER && !!chainId,
    queryFn: () => checkChainReady(chainId),
    staleTime: 10_000,
    refetchInterval: addJitter(30_000),
  });

  const isChainReady = chainReadyQuery.data === true;

  const indexerQuery = useQuery({
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
    refetchInterval: addJitter(10_000),
    retry: false,
  });

  const rpcQuery = useQuery({
    queryKey: ["rpc", "spotSells", chainId, marketKey, userAddress],
    enabled: !!marketKey && !!userAddress && !!publicClient && !!tickBookManagerAddress,
    queryFn: async () => {
      const sellIds = await publicClient!.readContract({
        address: tickBookManagerAddress!,
        abi: ABIS.TickBookPoolManager,
        functionName: "getUserSpotSells",
        args: [marketKey!, userAddress!],
      }) as bigint[];

      if (!sellIds.length) return [];

      const results = await publicClient!.multicall({
        contracts: sellIds.map(sellId => ({
          address: tickBookManagerAddress!,
          abi: ABIS.TickBookPoolManager,
          functionName: "getSpotSellOrder",
          args: [marketKey!, sellId],
        })),
        allowFailure: true,
      });

      const spotSells: SpotSellOrderIndexed[] = [];
      for (let i = 0; i < sellIds.length; i++) {
        const res = results[i];
        if (res.status === "success" && res.result) {
          const order = res.result as any;
          if (!order.active) continue;
          spotSells.push({
            sellId: sellIds[i],
            owner: order.owner.toLowerCase() as Address,
            outcome: order.outcome as 0 | 1,
            tickLower: order.tickLower,
            tickUpper: order.tickUpper,
            sharesTotal: order.sharesTotal,
            sharesFilled: order.sharesFilled,
            active: order.active,
          });
        }
      }

      return spotSells;
    },
    staleTime: 5_000,
    refetchInterval: addJitter(10_000),
  });

  const useIndexer = USE_INDEXER && isChainReady && (indexerQuery.data?.length ?? 0) > 0;
  const indexerSpotSells = indexerQuery.data ?? [];
  const rpcSpotSells = rpcQuery.data ?? [];

  const finalSpotSells = useIndexer ? indexerSpotSells : rpcSpotSells;

  return {
    spotSells: finalSpotSells,
    isLoading: useIndexer 
      ? (indexerQuery.isLoading || chainReadyQuery.isLoading)
      : rpcQuery.isLoading,
    error: useIndexer ? indexerQuery.error : rpcQuery.error,
    refetch: useIndexer ? indexerQuery.refetch : rpcQuery.refetch,
    source: useIndexer ? ("indexer" as const) : ("rpc" as const),
    isChainReady,
  };
}
