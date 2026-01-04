import { useChainStore } from "../../store/useChainStore";
import { useUserOrdersDirect, RangeOrder } from "../useUserOrdersDirect";

type Address = `0x${string}`;

/**
 * Hook to fetch user's orders - ALWAYS uses RPC
 * 
 * The indexer CANNOT accurately track pending fills because the contract uses
 * a global pro-rata accumulator system. Only the contract's getPendingFills()
 * view function knows the true pending amounts.
 * 
 * We previously tried using indexer with RPC merge, but this was error-prone.
 * RPC is fast enough for user orders (typically < 200 orders per user).
 */
export function useOrdersIndexed(
  marketKey: `0x${string}` | undefined,
  userAddress: Address | undefined
) {
  const { selectedChainId } = useChainStore();
  const chainId = typeof selectedChainId === "number" ? selectedChainId : Number(selectedChainId);

  // Always use RPC - indexer cannot track pending fills accurately
  const rpcQuery = useUserOrdersDirect(marketKey, userAddress);

  // Filter to only active orders
  const activeOrders = rpcQuery.orders.filter(o => o.active);

  return {
    orders: activeOrders,
    isLoading: rpcQuery.isLoading,
    error: rpcQuery.error,
    refetch: rpcQuery.refetch,
    source: "rpc" as const,
  };
}
