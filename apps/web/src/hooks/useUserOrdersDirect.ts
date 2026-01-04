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
  filledShares: bigint;       // Claimed fills
  pendingShares: bigint;      // Unclaimed fills from accumulator
  collateralUsedWad: bigint;
  active: boolean;
  createdAt?: number;         // Unix timestamp (seconds) from indexer
}

// RangeOrderPlaced event signature
const RANGE_ORDER_PLACED_EVENT = parseAbiItem(
  "event RangeOrderPlaced(address indexed owner, bytes32 indexed marketKey, uint256 indexed orderId, uint8 outcome, uint16 tickLower, uint16 tickUpper, uint256 liquidity, uint256 collateralReserved, uint256 crossingFilled, uint256 crossingCost)"
);

// Batch size and delay to avoid RPC rate limits (429)
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 100;

/**
 * Hook to fetch user's orders from TickBookPoolManager (V9 Architecture)
 *
 * Uses chunked Promise.all with delays to avoid RPC rate limits.
 * Does NOT use multicall3 (not supported on Arc/Monad/Base testnets).
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
          abi: V996_ABIS.TickBookPoolManager,
          functionName: "getUserOrders",
          args: [marketKey!, userAddress!],
        }) ?? [];
        console.log(`[useUserOrdersDirect] getUserOrders returned: ${orderIds.length} orders`, orderIds);
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

      // Chunked Promise.all to avoid RPC rate limits (no multicall3 support)
      const orders: RangeOrder[] = [];

      for (let i = 0; i < orderIds.length; i += BATCH_SIZE) {
        const batch = orderIds.slice(i, i + BATCH_SIZE);

        const batchResults = await Promise.all(
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
                return {
                  orderId,
                  ...order,
                  pendingShares: pendingFills?.[0] ?? 0n,
                };
              }
              return null;
            } catch (err) {
              console.error(`[useUserOrdersDirect] Failed to fetch order ${orderId}:`, err);
              return null;
            }
          })
        );

        for (const result of batchResults) {
          if (result) orders.push(result);
        }

        // Rate limit delay between batches
        if (i + BATCH_SIZE < orderIds.length) {
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
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
