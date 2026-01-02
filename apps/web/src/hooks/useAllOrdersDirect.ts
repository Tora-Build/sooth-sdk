import { useChainStore } from "../store/useChainStore";
import { useDeployments } from "./useDeployments";
import { V996_ABIS } from "../config/abis";
import { useDirectRead, readContractSafe } from "./useDirectRead";
import { parseAbiItem } from "viem";

type Address = `0x${string}`;

export interface RangeOrder {
  orderId: bigint;
  owner: Address;
  outcome: number;
  tickLower: number;
  tickUpper: number;
  sharesTotal: bigint;
  liquidity: bigint;
  collateralDepositedWad: bigint;
  filledShares: bigint;
  pendingShares: bigint;
  collateralUsedWad: bigint;
  active: boolean;
}

// RangeOrderPlaced event signature (no owner filter)
const RANGE_ORDER_PLACED_EVENT = parseAbiItem(
  "event RangeOrderPlaced(address indexed owner, bytes32 indexed marketKey, uint256 indexed orderId, uint8 outcome, uint16 tickLower, uint16 tickUpper, uint256 liquidity, uint256 collateralReserved, uint256 crossingFilled, uint256 crossingCost)"
);

/**
 * Hook to fetch ALL orders for a market from TickBookPoolManager (V9 Architecture)
 * Used for displaying the full orderbook depth on the Pro page.
 *
 * Unlike useUserOrdersDirect, this fetches orders from ALL users.
 */
export function useAllOrdersDirect(marketKey: `0x${string}` | undefined) {
  const { selectedChainId } = useChainStore();
  const chainId = typeof selectedChainId === "number" ? selectedChainId : Number(selectedChainId);
  const deployments = useDeployments();
  const tickBookManagerAddress = deployments?.contracts?.TickBookPoolManager as Address | undefined;

  const query = useDirectRead({
    queryKey: ["v9", "allOrders", chainId, tickBookManagerAddress, marketKey],
    enabled: !!marketKey && !!chainId && !!tickBookManagerAddress,
    chainId,
    read: async (client) => {
      console.log(`[useAllOrdersDirect] Querying ALL orders for market ${marketKey}`);

      try {
        // V9.9.6-fix4: Try getAllMarketOrders first (reliable, no RPC limits)
        let orderIds: bigint[] = [];

        try {
          orderIds = await readContractSafe<bigint[]>(client, {
            address: tickBookManagerAddress!,
            abi: V996_ABIS.TickBookPoolManager,
            functionName: "getAllMarketOrders",
            args: [marketKey!],
          }) ?? [];
          console.log(`[useAllOrdersDirect] getAllMarketOrders returned ${orderIds.length} orders`);
        } catch {
          // Fallback to event scanning for older deployments
          console.log(`[useAllOrdersDirect] getAllMarketOrders not available, falling back to events`);

          const currentBlock = await client.getBlockNumber();
          const blocksToQuery = chainId === 10143 ? 50n : 50000n;
          const fromBlock = currentBlock > blocksToQuery ? currentBlock - blocksToQuery : 0n;

          const logs = await client.getLogs({
            address: tickBookManagerAddress!,
            event: RANGE_ORDER_PLACED_EVENT,
            args: {
              marketKey: marketKey!,
            },
            fromBlock,
            toBlock: "latest",
          });

          // Dedupe order IDs
          const orderIdSet = new Set<string>();
          for (const log of logs) {
            const id = log.args.orderId as bigint;
            const key = id.toString();
            if (!orderIdSet.has(key)) {
              orderIdSet.add(key);
              orderIds.push(id);
            }
          }
          console.log(`[useAllOrdersDirect] Found ${orderIds.length} unique orders from events`);
        }

        if (orderIds.length === 0) {
          return [];
        }

        // Fetch each order's details in parallel (batch for performance)
        const orders: RangeOrder[] = [];
        const batchSize = 10;

        for (let i = 0; i < orderIds.length; i += batchSize) {
          const batch = orderIds.slice(i, i + batchSize);
          const results = await Promise.all(
            batch.map(async (orderId) => {
              try {
                const [order, pendingFills] = await Promise.all([
                  readContractSafe<{
                    owner: Address;
                    outcome: number;
                    tickLower: number;
                    tickUpper: number;
                    active: boolean;
                    sharesTotal: bigint;
                    liquidity: bigint;
                    collateralDepositedWad: bigint;
                    filledShares: bigint;
                    collateralUsedWad: bigint;
                  }>(client, {
                    address: tickBookManagerAddress!,
                    abi: V996_ABIS.TickBookPoolManager,
                    functionName: "getOrder",
                    args: [marketKey!, orderId],
                  }),
                  readContractSafe<readonly [bigint, bigint]>(client, {
                    address: tickBookManagerAddress!,
                    abi: V996_ABIS.TickBookPoolManager,
                    functionName: "getPendingFills",
                    args: [marketKey!, orderId],
                  }),
                ]);

                if (order && order.active) {
                  const pendingShares = pendingFills?.[0] ?? 0n;
                  return {
                    orderId,
                    ...order,
                    pendingShares,
                  };
                }
                return null;
              } catch (err) {
                console.error(`[useAllOrdersDirect] Failed to fetch order ${orderId}:`, err);
                return null;
              }
            })
          );

          for (const result of results) {
            if (result) orders.push(result);
          }
        }

        console.log(`[useAllOrdersDirect] Final result: ${orders.length} active orders`);
        return orders;
      } catch (err) {
        console.error(`[useAllOrdersDirect] Failed to query orders:`, err);
        return [];
      }
    },
  });

  return {
    orders: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
