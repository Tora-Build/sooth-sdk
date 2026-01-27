import { useChainStore } from "../store/useChainStore";
import { ABIS } from "../config/abis";
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
        isFinalized,
        winningOutcome,
        startTime,
        deadline,
        creator,
        adjudicator,
        guardian,
        question,
        tStar,
        state,
      ] = await Promise.all([
        readContractSafe<boolean>(client, { address: marketAddress!, abi: ABIS.TruthMarket, functionName: "isLive" }),
        readContractSafe<boolean>(client, { address: marketAddress!, abi: ABIS.TruthMarket, functionName: "isSettled" }),
        readContractSafe<boolean>(client, { address: marketAddress!, abi: ABIS.TruthMarket, functionName: "isFinalized" }),
        readContractSafe<number>(client, { address: marketAddress!, abi: ABIS.TruthMarket, functionName: "winningOutcome" }),
        readContractSafe<bigint>(client, { address: marketAddress!, abi: ABIS.TruthMarket, functionName: "startTime" }),
        readContractSafe<bigint>(client, { address: marketAddress!, abi: ABIS.TruthMarket, functionName: "deadline" }),
        readContractSafe<Address>(client, { address: marketAddress!, abi: ABIS.TruthMarket, functionName: "creator" }),
        readContractSafe<Address>(client, { address: marketAddress!, abi: ABIS.TruthMarket, functionName: "adjudicator" }),
        readContractSafe<Address>(client, { address: marketAddress!, abi: ABIS.TruthMarket, functionName: "guardian" }),
        readContractSafe<string>(client, { address: marketAddress!, abi: ABIS.TruthMarket, functionName: "question" }),
        readContractSafe<bigint>(client, { address: marketAddress!, abi: ABIS.TruthMarket, functionName: "tStar" }),
        readContractSafe<number>(client, { address: marketAddress!, abi: ABIS.TruthMarket, functionName: "state" }),
      ]);

      const now = Math.floor(Date.now() / 1000);
      const startTimestamp = Number(startTime);
      const deadlineTimestamp = Number(deadline);
      let status: "live" | "settled" | "finalized" | "expired" | "pending";
      if (isFinalized) status = "finalized";
      else if (isSettled || state === 3) status = "settled";
      else if (now < startTimestamp) status = "pending";
      else if (now >= deadlineTimestamp) status = "expired";
      else if (isLive) status = "live";
      else status = "pending";

       const result = {
         address: marketAddress!,
         isLive,
         isSettled,
         isFinalized,
         winningOutcome,
         startTime: startTimestamp,
         deadline: deadlineTimestamp,
         creator,
         adjudicator,
         guardian,
         question,
         tStar: tStar ? Number(tStar) : undefined,
         state,
         status,
         timeRemaining: Math.max(0, deadlineTimestamp - now),
         isExpired: status === "expired",
         isPending: status === "pending",
         isVetoed: state === 4,
         hasWinner: isSettled && winningOutcome !== undefined,
       };
       
       console.log('[useTruthMarketDirect] Fetched data:', { 
         market: marketAddress, 
         adjudicator, 
         creator,
         isZeroAddress: adjudicator === '0x0000000000000000000000000000000000000000'
       });
       
       return result;
    },
  });

  return {
    market: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
