import { useChainStore } from "../store/useChainStore";
import { useDeployments } from "./useDeployments";
import { V9_ABIS } from "../config/abis";
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
  collateralUsedWad: bigint;
  active: boolean;
}

// RangeOrderPlaced event signature
const RANGE_ORDER_PLACED_EVENT = parseAbiItem(
  "event RangeOrderPlaced(address indexed owner, bytes32 indexed marketKey, uint256 indexed orderId, uint8 outcome, uint16 tickLower, uint16 tickUpper, uint256 liquidity, uint256 collateralReserved, uint256 crossingFilled, uint256 crossingCost)"
);

/**
 * Hook to fetch user's orders from TickBookPoolManager (V9 Architecture)
 *
 * Note: Uses event logs to discover order IDs since getUserOrders() is missing
 * from the deployed contract. This will be replaced with direct contract call
 * after contract redeployment.
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
      // Try getUserOrders first (for future redeployed contracts)
      let orderIds: bigint[] = [];
      console.log(`[useUserOrdersDirect] Querying ${tickBookManagerAddress} for user ${userAddress} on market ${marketKey}`);
      try {
        orderIds = await readContractSafe<bigint[]>(client, {
          address: tickBookManagerAddress!,
          abi: V9_ABIS.TickBookPoolManager,
          functionName: "getUserOrders",
          args: [marketKey!, userAddress!],
        }) ?? [];
        console.log(`[useUserOrdersDirect] getUserOrders returned: ${orderIds.length} orders`, orderIds);
      } catch {
        // getUserOrders not available - fallback to event logs
        console.log("[useUserOrdersDirect] getUserOrders not available, using event logs");

        // Query RangeOrderPlaced events for this user and market
        const logs = await client.getLogs({
          address: tickBookManagerAddress!,
          event: RANGE_ORDER_PLACED_EVENT,
          args: {
            owner: userAddress!,
            marketKey: marketKey!,
          },
          fromBlock: "earliest",
          toBlock: "latest",
        });

        orderIds = logs.map(log => log.args.orderId as bigint);
        console.log(`[useUserOrdersDirect] Found ${orderIds.length} orders from events`);
      }

      if (!orderIds || orderIds.length === 0) {
        return [];
      }

      // Fetch each order's details
      const orders: RangeOrder[] = [];
      for (const orderId of orderIds) {
        try {
          // Solidity struct order: owner, outcome, tickLower, tickUpper, active, sharesTotal, liquidity, collateralDepositedWad, filledShares, collateralUsedWad
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
              abi: V9_ABIS.TickBookPoolManager,
              functionName: "getOrder",
              args: [marketKey!, orderId],
            }),
            readContractSafe<readonly [bigint, bigint]>(client, {
              address: tickBookManagerAddress!,
              abi: V9_ABIS.TickBookPoolManager,
              functionName: "getPendingFills",
              args: [marketKey!, orderId],
            }),
          ]);

          console.log(`[useUserOrdersDirect] Order ${orderId}:`, order ? `active=${order.active}, filled=${order.filledShares}, pending=${pendingFills?.[0]}` : 'null');

          if (order && order.active) {
            // Add pending fills (from accumulator) to the displayed filledShares
            const pendingShares = pendingFills?.[0] ?? 0n;
            const totalFilledShares = order.filledShares + pendingShares;

            orders.push({
              orderId,
              ...order,
              filledShares: totalFilledShares,
            });
            console.log(`[useUserOrdersDirect] Order ${orderId} ACTIVE, total filled=${totalFilledShares}`);
          }
        } catch (err) {
          console.error(`[useUserOrdersDirect] Failed to fetch order ${orderId}:`, err);
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
