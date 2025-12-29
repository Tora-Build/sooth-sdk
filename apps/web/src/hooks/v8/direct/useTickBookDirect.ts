import { keccak256, encodePacked } from "viem";
import { useChainStore } from "../../../store/useChainStore";
import { useDeployments } from "../../useDeployments";
import { V9_ABIS } from "../../../config/abis";
import { useV8DirectRead, readContractSafe } from "./useV8DirectRead";

type Address = `0x${string}`;

/**
 * Hook to read TickBook state for the Pro page (V9 Singleton Architecture)
 * Handles Singleton TickBookPoolManager mapping and tick discovery.
 */
export function useTickBookDirect(
  marketAddress: Address | undefined,
  yesToken: Address | undefined,
  noToken: Address | undefined,
  hookAddress?: Address
) {
  const { selectedChainId } = useChainStore();
  const chainId = typeof selectedChainId === "number" ? selectedChainId : Number(selectedChainId);
  const deployments = useDeployments();
  const poolManagerAddress = deployments?.contracts?.TickBookPoolManager as Address | undefined;

  // Default to DynamicFeeHook address if not provided and it exists in deployments
  const effectiveHook = hookAddress || (deployments?.contracts?.DynamicFeeHook as Address) || "0x0000000000000000000000000000000000000000";

  // V9 Market Key: keccak256(truthMarket, yesToken, noToken, hook)
  const marketKey = marketAddress && yesToken && noToken
    ? keccak256(encodePacked(["address", "address", "address", "address"], [marketAddress, yesToken, noToken, effectiveHook]))
    : undefined;

  const query = useV8DirectRead({
    queryKey: ["v9", "tickBookDirect", chainId, poolManagerAddress, marketKey],
    enabled: !!marketKey && !!chainId && !!poolManagerAddress,
    chainId,
    read: async (client) => {
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
          marketKey,
          currentTick: 500,
          probability: 0.5,
          isActive: false,
          truthMarket,
          yesToken: yesTokenAddr,
          noToken: noTokenAddr,
          hook: hookAddr,
          bids: [],
          asks: [],
        };
      }

      // Fetch nearby active boundary ticks for visualization
      const fetchTicks = async (start: number, count: number, isUp: boolean, outcome: number) => {
        const ticks = [];
        let current = start;
        for (let i = 0; i < count; i++) {
          const next = await readContractSafe<number>(client, {
            address: poolManagerAddress!,
            abi: V9_ABIS.TickBookPoolManager,
            functionName: "findNextActiveTick",
            args: [marketKey!, current, isUp, outcome],
          });

          // Terminators: 0 or 1000 means no more ticks found in that direction
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
        }
        return ticks;
      };

      const [bids, asks] = await Promise.all([
        fetchTicks(0, 10, true, 0),    // NO depth (Bids for NO traders)
        fetchTicks(1000, 10, false, 1), // YES depth (Asks for YES traders)
      ]);

      return {
        marketKey,
        currentTick: tickIndex,
        probability: Number(probabilityWad) / 10 ** 18,
        isActive,
        truthMarket,
        yesToken: yesTokenAddr,
        noToken: noTokenAddr,
        hook: hookAddr,
        activeLiquidityNo: activeLiqNo,
        activeLiquidityYes: activeLiqYes,
        bids: bids.sort((a, b) => b.index - a.index), // highest bids first
        asks: asks.sort((a, b) => a.index - b.index), // lowest asks first
      };
    },
  });

  return {
    tickBook: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
