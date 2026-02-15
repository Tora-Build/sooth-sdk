import { useQuery } from '@tanstack/react-query';
import { createPublicClient, http, type Address, parseAbi } from 'viem';
import { baseSepolia } from 'viem/chains';
import type { OrderLevel } from '../components/OrderBook';

// SoothBook V12 on Base Sepolia
export const SOOTHBOOK_ADDRESS = '0x9a992959490578c8f171C25BC8615E9Cc1AA2aB8' as Address;
export const MOCK_USDC_ADDRESS = '0x39d579b27011FCE3f944Aa0DfBb1885279c9eD89' as Address;

const SOOTHBOOK_ABI = parseAbi([
  'function markets(bytes32) view returns (address collateral, address yesToken, address noToken, bool active, bool finalized, uint8 outcome)',
  'function getBalance(bytes32, address) view returns (uint256 yes, uint256 no)',
  'function getCollateralBacking(bytes32) view returns (uint256)',
  'function getBestTick(bytes32, uint8) view returns (uint16)',
  'function getOrdersAtTick(bytes32, uint8, uint16) view returns (uint256 totalAmount, uint256 orderCount)',
  'function getImpliedPrice(bytes32) view returns (uint256 yesPrice, uint256 noPrice)',
  'function buyYes(bytes32, uint16, uint128, bool, uint256)',
  'function buyNo(bytes32, uint16, uint128, bool, uint256)',
  'function mint(bytes32, uint256)',
  'function merge(bytes32, uint256)',
  'function cancel(bytes32, uint8, uint16)',
]);

const client = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

export interface SoothBookMarket {
  marketKey: `0x${string}`;
  question: string;
  collateral: Address;
  yesToken: Address;
  noToken: Address;
  active: boolean;
  finalized: boolean;
  outcome: number;
}

// Known markets on Base Sepolia
export const MARKETS: SoothBookMarket[] = [
  {
    marketKey: '0x79a7bc6308ae7267ddd3776d02ad1446f41d1e3ed74ed41b5184fc53cc8bd5b5',
    question: 'Will BTC hit $100k by end of 2026?',
    collateral: MOCK_USDC_ADDRESS,
    yesToken: '0x7C68410557A837B4Cc0f9595CA75186e4A66a705' as Address,
    noToken: '0x04280B7C3584c4fd66885d2C32F3B89c1C4eE972' as Address,
    active: true,
    finalized: false,
    outcome: 0,
  },
];

/**
 * Scan ticks to build orderbook levels
 * Scans from best tick downward, collecting non-empty ticks
 */
async function scanOrderBook(
  marketKey: `0x${string}`,
  side: 0 | 1,
  maxLevels: number = 15
): Promise<OrderLevel[]> {
  const levels: OrderLevel[] = [];

  // Get best tick
  const bestTick = await client.readContract({
    address: SOOTHBOOK_ADDRESS,
    abi: SOOTHBOOK_ABI,
    functionName: 'getBestTick',
    args: [marketKey, side],
  });

  if (bestTick > 999) return levels; // no orders

  // Scan downward from best tick
  let tick = Number(bestTick);
  let scanned = 0;

  while (tick >= 1 && levels.length < maxLevels && scanned < 50) {
    const [totalAmount, orderCount] = await client.readContract({
      address: SOOTHBOOK_ADDRESS,
      abi: SOOTHBOOK_ABI,
      functionName: 'getOrdersAtTick',
      args: [marketKey, side, tick],
    });

    if (totalAmount > 0n) {
      levels.push({
        tick,
        price: tick / 1000,
        amount: totalAmount,
        count: Number(orderCount),
      });
    }

    tick--;
    scanned++;
  }

  return levels;
}

/**
 * Fetch full orderbook for a market
 */
export function useOrderBook(marketKey: `0x${string}`) {
  return useQuery({
    queryKey: ['orderbook', marketKey],
    queryFn: async () => {
      const [yesBids, noBids, impliedPrice] = await Promise.all([
        scanOrderBook(marketKey, 1),  // YES side
        scanOrderBook(marketKey, 0),  // NO side
        client.readContract({
          address: SOOTHBOOK_ADDRESS,
          abi: SOOTHBOOK_ABI,
          functionName: 'getImpliedPrice',
          args: [marketKey],
        }),
      ]);

      return {
        yesBids,
        noBids,
        yesPrice: Number(impliedPrice[0]) / 1e18,
        noPrice: Number(impliedPrice[1]) / 1e18,
      };
    },
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}

/**
 * Fetch market info
 */
export function useMarketInfo(marketKey: `0x${string}`) {
  return useQuery({
    queryKey: ['market-info', marketKey],
    queryFn: async () => {
      const result = await client.readContract({
        address: SOOTHBOOK_ADDRESS,
        abi: SOOTHBOOK_ABI,
        functionName: 'markets',
        args: [marketKey],
      });

      const backing = await client.readContract({
        address: SOOTHBOOK_ADDRESS,
        abi: SOOTHBOOK_ABI,
        functionName: 'getCollateralBacking',
        args: [marketKey],
      });

      return {
        collateral: result[0],
        yesToken: result[1],
        noToken: result[2],
        active: result[3],
        finalized: result[4],
        outcome: result[5],
        backing,
      };
    },
    staleTime: 30_000,
  });
}

export { SOOTHBOOK_ABI, client as soothBookClient };
