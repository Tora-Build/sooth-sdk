import { type PublicClient, type Address } from 'viem';
import { POOL_MANAGER_ABI, type NetworkConfig } from './config.js';
import type { RangeOrder, SpotSellOrder, MarketInfo } from './types.js';

export async function getMarketInfo(
  client: PublicClient,
  config: NetworkConfig,
  marketKey: `0x${string}`
): Promise<MarketInfo | null> {
  try {
    const result = await client.readContract({
      address: config.contracts.TickBookPoolManager,
      abi: POOL_MANAGER_ABI,
      functionName: 'getMarketInfo',
      args: [marketKey],
    });

    const [truthMarket, yesToken, noToken, isActive] = result as [Address, Address, Address, boolean];
    
    if (truthMarket === '0x0000000000000000000000000000000000000000') {
      return null;
    }

    return {
      marketKey,
      truthMarket,
      yesToken,
      noToken,
      isActive,
    };
  } catch {
    return null;
  }
}

export async function getAllOrders(
  client: PublicClient,
  config: NetworkConfig,
  marketKey: `0x${string}`
): Promise<RangeOrder[]> {
  const orderIds = await client.readContract({
    address: config.contracts.TickBookPoolManager,
    abi: POOL_MANAGER_ABI,
    functionName: 'getAllMarketOrders',
    args: [marketKey],
  }) as bigint[];

  const orders: RangeOrder[] = [];

  for (const orderId of orderIds) {
    try {
      const order = await client.readContract({
        address: config.contracts.TickBookPoolManager,
        abi: POOL_MANAGER_ABI,
        functionName: 'getOrder',
        args: [marketKey, orderId],
      }) as {
        owner: Address;
        outcome: number;
        tickLower: number;
        tickUpper: number;
        active: boolean;
        liquidityRemoved: boolean;
        sharesTotal: bigint;
        liquidity: bigint;
        collateralDepositedWad: bigint;
        filledShares: bigint;
        collateralUsedWad: bigint;
      };

      if (order.active) {
        const restingShares = order.sharesTotal - order.filledShares;
        if (restingShares > 0n) {
          orders.push({
            orderId,
            ...order,
          });
        }
      }
    } catch {
      continue;
    }
  }

  return orders;
}

export async function getAllSpotSells(
  client: PublicClient,
  config: NetworkConfig,
  marketKey: `0x${string}`
): Promise<SpotSellOrder[]> {
  const sellIds = await client.readContract({
    address: config.contracts.TickBookPoolManager,
    abi: POOL_MANAGER_ABI,
    functionName: 'getAllMarketSpotSells',
    args: [marketKey],
  }) as bigint[];

  const spotSells: SpotSellOrder[] = [];

  for (const sellId of sellIds) {
    try {
      const sell = await client.readContract({
        address: config.contracts.TickBookPoolManager,
        abi: POOL_MANAGER_ABI,
        functionName: 'getSpotSellOrder',
        args: [marketKey, sellId],
      }) as {
        owner: Address;
        outcome: number;
        tickLower: number;
        tickUpper: number;
        active: boolean;
        sharesTotal: bigint;
        filledShares: bigint;
        proceedsClaimedWad: bigint;
      };

      if (sell.active) {
        const restingShares = sell.sharesTotal - sell.filledShares;
        if (restingShares > 0n) {
          spotSells.push({
            sellId,
            ...sell,
          });
        }
      }
    } catch {
      continue;
    }
  }

  return spotSells;
}

export async function scanMarket(
  client: PublicClient,
  config: NetworkConfig,
  marketKey: `0x${string}`
): Promise<{ orders: RangeOrder[]; spotSells: SpotSellOrder[] } | null> {
  const marketInfo = await getMarketInfo(client, config, marketKey);
  if (!marketInfo || !marketInfo.isActive) {
    return null;
  }

  const [orders, spotSells] = await Promise.all([
    getAllOrders(client, config, marketKey),
    getAllSpotSells(client, config, marketKey),
  ]);

  return { orders, spotSells };
}
