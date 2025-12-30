import { useChainStore } from "../store/useChainStore";
import { useDeployments } from "./useDeployments";
import { V9_ABIS } from "../config/abis";
import { useDirectRead, readContractSafe } from "./useDirectRead";
import { useMarketKey } from "./useMarketKey";

type Address = `0x${string}`;

export interface TickBookMarketState {
  marketKey: `0x${string}`;
  currentTick: number;
  probability: number;
  activeLiquidityNo: bigint;
  activeLiquidityYes: bigint;
  isActive: boolean;
  truthMarket: Address;
  yesToken: Address;
  noToken: Address;
  hook: Address;
  // Orderbook depth
  bids: TickLevel[];
  asks: TickLevel[];
}

interface TickLevel {
  index: number;
  price: number;
  liquidityNet: bigint;
  liquidityGross: bigint;
}

/**
 * Hook to read TickBookPoolManager state for a market (V9 Singleton Architecture)
 *
 * This replaces the per-market TickBook pattern from V8 with a singleton manager.
 */
export function useTickBookPoolManager(
  marketAddress: Address | undefined,
  yesToken: Address | undefined,
  noToken: Address | undefined,
  hookAddress?: Address
) {
  const { selectedChainId } = useChainStore();
  const chainId = typeof selectedChainId === "number" ? selectedChainId : Number(selectedChainId);
  const deployments = useDeployments();
  const poolManagerAddress = deployments?.contracts?.TickBookPoolManager as Address | undefined;

  const { marketKey, hook } = useMarketKey(marketAddress, yesToken, noToken, hookAddress);

  const query = useDirectRead({
    queryKey: ["v9", "tickBookPoolManager", chainId, poolManagerAddress, marketKey],
    enabled: !!marketKey && !!chainId && !!poolManagerAddress,
    chainId,
    read: async (client) => {
      // Batch read market state and info
      const [marketState, marketInfo] = await Promise.all([
        readContractSafe<readonly [number, bigint, bigint, bigint]>(client, {
          address: poolManagerAddress!,
          abi: V9_ABIS.TickBookPoolManager,
          functionName: "getMarketState",
          args: [marketKey!],
        }),
        readContractSafe<readonly [Address, Address, Address, Address, boolean]>(client, {
          address: poolManagerAddress!,
          abi: V9_ABIS.TickBookPoolManager,
          functionName: "getMarketInfo",
          args: [marketKey!],
        }),
      ]);

      const [tickIndex, activeLiqNo, activeLiqYes, probabilityWad] = marketState;
      const [truthMarket, yesTokenAddr, noTokenAddr, hookAddr, isActive] = marketInfo;

      if (!isActive) {
        return {
          marketKey: marketKey!,
          currentTick: 500,
          probability: 0.5,
          activeLiquidityNo: 0n,
          activeLiquidityYes: 0n,
          isActive: false,
          truthMarket,
          yesToken: yesTokenAddr,
          noToken: noTokenAddr,
          hook: hookAddr,
          bids: [],
          asks: [],
        } as TickBookMarketState;
      }

      // Fetch nearby active ticks for orderbook visualization
      const fetchTicks = async (
        start: number,
        count: number,
        isUp: boolean,
        outcome: number
      ): Promise<TickLevel[]> => {
        const ticks: TickLevel[] = [];
        let current = start;

        for (let i = 0; i < count; i++) {
          try {
            const next = await readContractSafe<number>(client, {
              address: poolManagerAddress!,
              abi: V9_ABIS.TickBookPoolManager,
              functionName: "findNextActiveTick",
              args: [marketKey!, current, isUp, outcome],
            });

            // Terminators: 0 or 1000 means no more ticks
            if (next === 0 || next >= 1000) break;

            const data = await readContractSafe<{ liquidityNet: bigint; liquidityGross: bigint }>(client, {
              address: poolManagerAddress!,
              abi: V9_ABIS.TickBookPoolManager,
              functionName: "getTickInfo",
              args: [marketKey!, outcome, next],
            });

            ticks.push({
              index: next,
              price: next / 1000,
              liquidityNet: data.liquidityNet,
              liquidityGross: data.liquidityGross,
            });

            current = isUp ? next + 1 : next - 1;
            if (current < 1 || current > 999) break;
          } catch {
            // Tick doesn't exist or read failed
            break;
          }
        }

        return ticks;
      };

      const [bids, asks] = await Promise.all([
        fetchTicks(0, 10, true, 0), // NO depth (bids)
        fetchTicks(1000, 10, false, 1), // YES depth (asks)
      ]);

      return {
        marketKey: marketKey!,
        currentTick: tickIndex,
        probability: Number(probabilityWad) / 1e18,
        activeLiquidityNo: activeLiqNo,
        activeLiquidityYes: activeLiqYes,
        isActive,
        truthMarket,
        yesToken: yesTokenAddr,
        noToken: noTokenAddr,
        hook: hookAddr,
        bids: bids.sort((a, b) => b.index - a.index), // Highest bids first
        asks: asks.sort((a, b) => a.index - b.index), // Lowest asks first
      } as TickBookMarketState;
    },
  });

  return {
    market: query.data ?? null,
    marketKey,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
