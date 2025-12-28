import { keccak256, encodePacked } from "viem";
import { useChainStore } from "../../../store/useChainStore";
import { useDeployments } from "../../useDeployments";
import { V8_ABIS } from "../../../config/abis";
import { useV8DirectRead, readContractSafe } from "./useV8DirectRead";

type Address = `0x${string}`;

/**
 * Hook to read TickBook state for the Pro page (vault-native, 1,000 tick)
 */
export function useTickBookDirect(marketAddress: Address | undefined, yesToken: Address | undefined, noToken: Address | undefined) {
  const { selectedChainId } = useChainStore();
  const chainId = typeof selectedChainId === "number" ? selectedChainId : Number(selectedChainId);
  const deployments = useDeployments();
  const tickBookAddress = deployments?.contracts?.TickBook as Address | undefined;

  const marketKey = marketAddress && yesToken && noToken
    ? keccak256(encodePacked(["address", "address", "address"], [marketAddress, yesToken, noToken]))
    : undefined;

  const query = useV8DirectRead({
    queryKey: ["v8", "tickBookDirect", chainId, tickBookAddress, marketKey],
    enabled: !!marketKey && !!chainId && !!tickBookAddress,
    chainId,
    read: async (client) => {
      const [currentTickData, marketInfo] = await Promise.all([
        readContractSafe<readonly [number, bigint]>(client, {
          address: tickBookAddress!,
          abi: V8_ABIS.TickBook,
          functionName: "getCurrentTick",
          args: [marketKey!],
        }),
        readContractSafe<readonly [Address, Address, Address, boolean]>(client, {
          address: tickBookAddress!,
          abi: V8_ABIS.TickBook,
          functionName: "getMarketInfo",
          args: [marketKey!],
        }),
      ]);

      const [tickIndex, probabilityWad] = currentTickData;
      const [truthMarket, yesTokenAddr, noTokenAddr, isActive] = marketInfo;

      if (!isActive) {
        return {
          marketKey,
          currentTick: 500,
          probability: 0.5,
          isActive: false,
          truthMarket,
          yesToken: yesTokenAddr,
          noToken: noTokenAddr,
          bids: [],
          asks: [],
        };
      }

      // Fetch nearby active ticks for the orderbook visualization
      // Use new 4-arg signature: findNextActiveTick(marketKey, startTick, isUp, outcome)
      const fetchTicks = async (start: number, count: number, isUp: boolean, outcome: number) => {
        const ticks = [];
        let current = start;
        for (let i = 0; i < count; i++) {
          const next = await readContractSafe<number>(client, {
            address: tickBookAddress!,
            abi: V8_ABIS.TickBook,
            functionName: "findNextActiveTick",
            args: [marketKey!, current, isUp, outcome],
          });
          if (next === 0 || next > 999) break;
          
          const data = await readContractSafe<{ yesDepth: bigint; noDepth: bigint }>(client, {
            address: tickBookAddress!,
            abi: V8_ABIS.TickBook,
            functionName: "getTick",
            args: [marketKey!, next],
          });
          
          ticks.push({
            index: next,
            price: next / 1000,
            yesDepth: data.yesDepth,
            noDepth: data.noDepth,
          });
          current = isUp ? next + 1 : next - 1;
          if (current < 1 || current > 998) break;
        }
        return ticks;
      };

      // Bids are NO-side orders (bought by YES buyers going up)
      // Asks are YES-side orders (bought by NO buyers going down)
      const [bids, asks] = await Promise.all([
        fetchTicks(1, 10, true, 0),  // NO depth from low → high
        fetchTicks(998, 10, false, 1), // YES depth from high → low
      ]);

      return {
        marketKey,
        currentTick: tickIndex,
        probability: Number(probabilityWad) / 1e18,
        isActive,
        truthMarket,
        yesToken: yesTokenAddr,
        noToken: noTokenAddr,
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
