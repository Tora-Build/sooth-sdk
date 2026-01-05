import { useChainStore } from "../store/useChainStore";
import { useDeployments } from "./useDeployments";
import { V10_ABIS } from "../config/abis";
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
  filledShares: bigint;       // Claimed fills
  pendingShares: bigint;      // Unclaimed fills from accumulator (shares)
  pendingUsdc?: bigint;       // Unclaimed fills from accumulator (USDC)
  collateralUsedWad: bigint;
  active: boolean;
  createdAt?: number;         // Unix timestamp (seconds) from indexer
}

// RangeOrderPlaced event signature
const RANGE_ORDER_PLACED_EVENT = parseAbiItem(
  "event RangeOrderPlaced(address indexed owner, bytes32 indexed marketKey, uint256 indexed orderId, uint8 outcome, uint16 tickLower, uint16 tickUpper, uint256 liquidity, uint256 collateralReserved, uint256 crossingFilled, uint256 crossingCost)"
);


/**
 * Hook to fetch user's orders from TickBookPoolManager (V9 Architecture)
 *
 * Uses multicall to efficiently fetch order details.
 */
export function useUserOrdersDirect(
  marketKey: `0x${string}` | undefined,
  userAddress: Address | undefined
) {
  const { selectedChainId } = useChainStore();
  const chainId = typeof selectedChainId === "number" ? selectedChainId : Number(selectedChainId);
  const deployments = useDeployments();
  const tickBookManagerAddress = deployments?.contracts?.TickBookPoolManager as Address | undefined;

  const query = useDirectRead({
    queryKey: ["v9", "userOrders", chainId, tickBookManagerAddress, marketKey, userAddress],
    enabled: !!marketKey && !!userAddress && !!chainId && !!tickBookManagerAddress,
    chainId,
    read: async (client) => {
      // Try getUserOrders first
      let orderIds: bigint[] = [];
      console.log(`[useUserOrdersDirect] Querying ${tickBookManagerAddress} for user ${userAddress} on market ${marketKey}`);
      try {
        orderIds = await readContractSafe<bigint[]>(client, {
          address: tickBookManagerAddress!,
          abi: V10_ABIS.TickBookPoolManager,
          functionName: "getUserOrders",
          args: [marketKey!, userAddress!],
        }) ?? [];
        console.log(`[useUserOrdersDirect] getUserOrders returned: ${orderIds.length} orders`);
      } catch {
        // getUserOrders not available - fallback to event logs
        console.log("[useUserOrdersDirect] getUserOrders not available, using event logs");

        // Monad has stricter limits - use smaller block range
        const currentBlock = await client.getBlockNumber();
        const blocksToQuery = chainId === 10143 ? 50n : 50000n;
        const fromBlock = currentBlock > blocksToQuery ? currentBlock - blocksToQuery : 0n;

        const logs = await client.getLogs({
          address: tickBookManagerAddress!,
          event: RANGE_ORDER_PLACED_EVENT,
          args: {
            owner: userAddress!,
            marketKey: marketKey!,
          },
          fromBlock,
          toBlock: "latest",
        });

        orderIds = logs.map(log => log.args.orderId as bigint);
        console.log(`[useUserOrdersDirect] Found ${orderIds.length} orders from events`);
      }

      if (!orderIds || orderIds.length === 0) {
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
            abi: V10_ABIS.TickBookPoolManager,
            functionName: "getOrder",
            args: [marketKey!, orderId]
          },
          {
            address: tickBookManagerAddress!,
            abi: V10_ABIS.TickBookPoolManager,
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
                  pendingUsdc: pendingFills?.[1] ?? 0n,
                });
              }
            }
          }
        } catch (err) {
          console.error(`[useUserOrdersDirect] Multicall batch failed:`, err);
        }
      }

      console.log(`[useUserOrdersDirect] Final result: ${orders.length} active orders`);
      return orders;
    },
  });

  return {
    orders: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
