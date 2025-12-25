import { keccak256, encodePacked } from "viem";
import { useChainStore } from "../../../store/useChainStore";
import { useDeployments } from "../../useDeployments";
import { V8_ABIS } from "../../../config/abis";
import { useV8DirectRead, readContractSafe } from "./useV8DirectRead";

type Address = `0x${string}`;

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

      // Fetch nearby active ticks for the orderbook visualization
      // We'll fetch up to 10 ticks in each direction for now
      const fetchTicks = async (start: number, count: number, isUp: boolean) => {
        const ticks = [];
        let current = start;
        for (let i = 0; i < count; i++) {
          const next = await readContractSafe<number>(client, {
            address: tickBookAddress!,
            abi: V8_ABIS.TickBook,
            functionName: "findNextActiveTick",
            args: [marketKey!, current, isUp],
          });
          if (next === 0 || next > 9999) break;
          
          const data = await readContractSafe<readonly [bigint, bigint]>(client, {
            address: tickBookAddress!,
            abi: V8_ABIS.TickBook,
            functionName: "getTick",
            args: [marketKey!, next],
          });
          
          ticks.push({
            index: next,
            price: next / 10000,
            yesDepth: data[0],
            noDepth: data[1],
          });
          current = isUp ? next + 1 : next - 1;
          if (current < 0 || current > 9999) break;
        }
        return ticks;
      };

      const [bids, asks] = await Promise.all([
        fetchTicks(tickIndex, 10, false), 
        fetchTicks(tickIndex + 1, 10, true), 
      ]);

      return {
        marketKey,
        currentTick: tickIndex,
        probability: Number(probabilityWad) / 1e18,
        isActive,
        truthMarket,
        yesToken: yesTokenAddr,
        noToken: noTokenAddr,
        bids: bids.sort((a, b) => b.index - a.index), 
        asks: asks.sort((a, b) => a.index - b.index), 
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

