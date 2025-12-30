import { useChainStore } from "../store/useChainStore";
import { useDeployments } from "./useDeployments";
import { V8_ABIS } from "../config/abis";
import { useDirectRead, readContractSafe } from "./useDirectRead";
import { parseUnits } from "viem";

type Address = `0x${string}`;

/**
 * Hook to get real-time quotes from TickBookV2
 */
export function useTickBookQuoteDirect(
    marketKey: `0x${string}` | undefined,
    outcome: number, // 0 or 1
    amount: string | number
) {
    const { selectedChainId } = useChainStore();
    const chainId = typeof selectedChainId === "number" ? selectedChainId : Number(selectedChainId);
    const deployments = useDeployments();
    const tickBookAddress = deployments?.contracts?.TickBook as Address | undefined;

    const sharesWad = amount ? parseUnits(String(amount), 18) : 0n;

    const query = useDirectRead({
        queryKey: ["v8", "tickBookQuote", chainId, tickBookAddress, marketKey, outcome, sharesWad.toString()],
        enabled: !!marketKey && !!chainId && !!tickBookAddress && sharesWad > 0n,
        chainId,
        read: async (client) => {
            const result = await readContractSafe<readonly [bigint, bigint, number]>(client, {
                address: tickBookAddress!,
                abi: V8_ABIS.TickBook,
                functionName: "getQuote",
                args: [marketKey!, outcome, sharesWad],
            });

            const [sharesFillable, estimatedCost, finalTick] = result;

            return {
                sharesFillable,
                estimatedCost,
                finalTick,
                price: sharesFillable > 0n ? Number(estimatedCost * 100n / sharesFillable) / 100 : 0,
            };
        },
    });

    return {
        quote: query.data ?? null,
        isLoading: query.isLoading,
        error: query.error,
        refetch: query.refetch,
    };
}
