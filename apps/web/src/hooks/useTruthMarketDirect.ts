import { useChainStore } from "../store/useChainStore";
import { V8_ABIS } from "../config/abis";
import { useDirectRead, readContractSafe } from "./useDirectRead";

type Address = `0x${string}`;

export function useTruthMarketDirect(marketAddress: Address | undefined) {
  const { selectedChainId } = useChainStore();
  const chainId = typeof selectedChainId === "number" ? selectedChainId : Number(selectedChainId);

  const query = useDirectRead({
    queryKey: ["v8", "truthMarketDirect", chainId, marketAddress],
    enabled: !!marketAddress && !!chainId,
    chainId,
    read: async (client) => {
      const [
        isLive,
        isSettled,
        winningOutcome,
        deadline,
        creator,
        adjudicator,
        guardian,
        question,
        tStar,
        state,
      ] = await Promise.all([
        readContractSafe<boolean>(client, { address: marketAddress!, abi: V8_ABIS.TruthMarket, functionName: "isLive" }),
        readContractSafe<boolean>(client, { address: marketAddress!, abi: V8_ABIS.TruthMarket, functionName: "isSettled" }),
        readContractSafe<number>(client, { address: marketAddress!, abi: V8_ABIS.TruthMarket, functionName: "winningOutcome" }),
        readContractSafe<bigint>(client, { address: marketAddress!, abi: V8_ABIS.TruthMarket, functionName: "deadline" }),
        readContractSafe<Address>(client, { address: marketAddress!, abi: V8_ABIS.TruthMarket, functionName: "creator" }),
        readContractSafe<Address>(client, { address: marketAddress!, abi: V8_ABIS.TruthMarket, functionName: "adjudicator" }),
        readContractSafe<Address>(client, { address: marketAddress!, abi: V8_ABIS.TruthMarket, functionName: "guardian" }),
        readContractSafe<string>(client, { address: marketAddress!, abi: V8_ABIS.TruthMarket, functionName: "question" }),
        readContractSafe<bigint>(client, { address: marketAddress!, abi: V8_ABIS.TruthMarket, functionName: "tStar" }),
        readContractSafe<number>(client, { address: marketAddress!, abi: V8_ABIS.TruthMarket, functionName: "state" }),
      ]);

      const now = Math.floor(Date.now() / 1000);
      const deadlineTimestamp = Number(deadline);
      let status: "live" | "settled" | "expired" | "pending" | "vetoed";
      // State enum: 0=Pending, 1=Live, 2=Expired, 3=Settled, 4=Vetoed, 5=Finalized
      if (state === 4) status = "vetoed";
      else if (isSettled) status = "settled";
      else if (isLive) status = now > deadlineTimestamp ? "expired" : "live";
      else status = "pending";

      return {
        address: marketAddress!,
        isLive,
        isSettled,
        winningOutcome,
        deadline: deadlineTimestamp,
        creator,
        adjudicator,
        guardian,
        question,
        tStar: tStar ? Number(tStar) : undefined, // Settlement timestamp
        state, // Market state enum
        status,
        timeRemaining: Math.max(0, deadlineTimestamp - now),
        isExpired: status === "expired",
        isPending: status === "pending",
        isVetoed: state === 4,
        hasWinner: isSettled && winningOutcome !== undefined,
      };
    },
  });

  return {
    market: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
