import { useQuery } from '@tanstack/react-query'
import { client, SOOTHBOOK_ADDRESS, SOOTHBOOK_ABI } from './config'

export interface OrderLevel {
  tick: number
  price: number
  amount: bigint
  count: number
  cumulative: bigint
}

async function scanSide(
  marketKey: `0x${string}`,
  side: 0 | 1,
  maxLevels = 12
): Promise<OrderLevel[]> {
  const levels: OrderLevel[] = []

  const bestTick = await client.readContract({
    address: SOOTHBOOK_ADDRESS,
    abi: SOOTHBOOK_ABI,
    functionName: 'getBestTick',
    args: [marketKey, side],
  })

  if (bestTick > 999) return levels

  let tick = Number(bestTick)
  let scanned = 0
  let cum = 0n

  while (tick >= 1 && levels.length < maxLevels && scanned < 50) {
    const [totalAmount, orderCount] = await client.readContract({
      address: SOOTHBOOK_ADDRESS,
      abi: SOOTHBOOK_ABI,
      functionName: 'getOrdersAtTick',
      args: [marketKey, side, tick],
    })

    if (totalAmount > 0n) {
      cum += totalAmount
      levels.push({
        tick,
        price: tick / 1000,
        amount: totalAmount,
        count: Number(orderCount),
        cumulative: cum,
      })
    }

    tick--
    scanned++
  }

  return levels
}

export function useOrderBook(marketKey: `0x${string}`) {
  return useQuery({
    queryKey: ['orderbook', marketKey],
    queryFn: async () => {
      const [yesBids, noBids, implied] = await Promise.all([
        scanSide(marketKey, 1),
        scanSide(marketKey, 0),
        client.readContract({
          address: SOOTHBOOK_ADDRESS,
          abi: SOOTHBOOK_ABI,
          functionName: 'getImpliedPrice',
          args: [marketKey],
        }),
      ])
      return {
        yesBids,
        noBids,
        yesPrice: Number(implied[0]) / 1e18,
        noPrice: Number(implied[1]) / 1e18,
      }
    },
    staleTime: 10_000,
    refetchInterval: 15_000,
  })
}

export function useMarketInfo(marketKey: `0x${string}`) {
  return useQuery({
    queryKey: ['market-info', marketKey],
    queryFn: async () => {
      const m = await client.readContract({
        address: SOOTHBOOK_ADDRESS,
        abi: SOOTHBOOK_ABI,
        functionName: 'markets',
        args: [marketKey],
      })
      const backing = await client.readContract({
        address: SOOTHBOOK_ADDRESS,
        abi: SOOTHBOOK_ABI,
        functionName: 'getCollateralBacking',
        args: [marketKey],
      })
      return {
        collateral: m[0], yesToken: m[1], noToken: m[2],
        active: m[3], finalized: m[4], outcome: m[5], backing,
      }
    },
    staleTime: 30_000,
  })
}

export function fmt(amount: bigint): string {
  const n = Number(amount) / 1e18
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  if (n >= 1) return n.toFixed(0)
  if (n >= 0.01) return n.toFixed(2)
  return n > 0 ? '<0.01' : '0'
}
