import { useChainStore } from "../store/useChainStore";
import { useDeployments } from "./useDeployments";
import { ABIS } from "../config/abis";
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
 * Uses multicall to efficiently fetch order details.
 */
export function useAllOrdersDirect(marketKey: `0x${string}` | undefined) {
  const { selectedChainId } = useChainStore();
  const chainId = typeof selectedChainId === "number" ? selectedChainId : Number(selectedChainId);
  const deployments = useDeployments();
  const tickBookManagerAddress = deployments?.contracts?.TickBookPoolManager as Address | undefined;

  const query = useDirectRead({
    queryKey: ["v9", "allOrders", chainId, tickBookManagerAddress, marketKey],
    enabled: !!marketKey && marketKey !== "0x0" && marketKey !== "0x0000000000000000000000000000000000000000000000000000000000000000" && !!chainId && !!tickBookManagerAddress,
    chainId,
    read: async (client) => {
      console.log(`[useAllOrdersDirect] Querying ALL orders for market ${marketKey}`);

      try {
        // V9.9.6-fix4: Try getAllMarketOrders first (reliable, no RPC limits)
        let orderIds: bigint[] = [];

        try {
          orderIds = await readContractSafe<bigint[]>(client, {
            address: tickBookManagerAddress!,
            abi: ABIS.TickBookPoolManager,
            functionName: "getAllMarketOrders",
            args: [marketKey!],
          }) ?? [];
          console.log(`[useAllOrdersDirect] getAllMarketOrders returned ${orderIds.length} orders`);
        } catch {
          // Fallback to event scanning for older deployments
          console.log(`[useAllOrdersDirect] getAllMarketOrders not available, falling back to events`);

          const currentBlock = await client.getBlockNumber();
          // Monad has stricter limits - use smaller block range
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

        // Use Multicall for efficiency
        // Batch size of 50 to avoid RPC payload limits
        const MULTICALL_BATCH_SIZE = 50;
        const orders: RangeOrder[] = [];

        for (let i = 0; i < orderIds.length; i += MULTICALL_BATCH_SIZE) {
          const batchIds = orderIds.slice(i, i + MULTICALL_BATCH_SIZE);

          // Prepare contract calls for this batch
          const contracts = batchIds.flatMap(orderId => [
            {
              address: tickBookManagerAddress!,
              abi: ABIS.TickBookPoolManager,
              functionName: "getOrder",
              args: [marketKey!, orderId]
            },
            {
              address: tickBookManagerAddress!,
              abi: ABIS.TickBookPoolManager,
              functionName: "getPendingFills",
              args: [marketKey!, orderId]
            }
          ]);

          try {
            // Execute multicall
            const results = await client.multicall({
              contracts,
              allowFailure: true
            });

            // Process results
            for (let j = 0; j < batchIds.length; j++) {
              const orderId = batchIds[j];
              const orderResult = results[j * 2];
              const fillsResult = results[j * 2 + 1];

              if (orderResult.status === 'success' && orderResult.result) {
                const order = orderResult.result as any;

                if (order && order.active) {
                  const pendingFills = fillsResult.status === 'success'
                    ? (fillsResult.result as [bigint, bigint])
                    : [0n, 0n];

                  orders.push({
                    orderId,
                    ...order,
                    pendingShares: pendingFills?.[0] ?? 0n,
                  });
                }
              }
            }
          } catch (err) {
            console.error(`[useAllOrdersDirect] Multicall batch failed:`, err);
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
