import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { parseAbiItem } from 'viem';
import { usePublicClient } from 'wagmi';

const ORDER_PLACED = parseAbiItem(
  'event OrderPlaced(bytes32 indexed marketKey, uint8 side, uint16 tick, address indexed maker, uint128 amount, bool escrow)',
);
const ORDER_PLACED_V2 = parseAbiItem(
  'event OrderPlacedV2(bytes32 indexed marketKey, uint8 side, uint16 tick, address indexed maker, uint128 amount, bool escrow, uint64 orderId)',
);
const ORDER_FILLED = parseAbiItem(
  'event OrderFilled(bytes32 indexed marketKey, uint8 takerSide, uint16 yesTick, uint16 noTick, address indexed taker, address indexed maker, uint128 amount, uint256 surplus)',
);
const ORDER_FILLED_V2 = parseAbiItem(
  'event OrderFilledV2(bytes32 indexed marketKey, uint8 takerSide, uint16 yesTick, uint16 noTick, address indexed taker, address indexed maker, uint128 amount, uint256 surplus, uint64 makerOrderId)',
);
const ORDER_CANCELLED = parseAbiItem(
  'event OrderCancelled(bytes32 indexed marketKey, uint8 side, uint16 tick, address indexed maker, uint128 amount)',
);
const ORDER_CANCELLED_V2 = parseAbiItem(
  'event OrderCancelledV2(bytes32 indexed marketKey, uint8 side, uint16 tick, address indexed maker, uint128 amount, uint64 orderId)',
);

export type FeedItem = {
  id: string;
  type: 'placed' | 'filled' | 'cancelled';
  side: 'YES' | 'NO';
  tick: string;
  amount: bigint;
  who: `0x${string}`;
  block: bigint;
  logIndex: number;
  maker?: `0x${string}`;
  makerSide?: 'YES' | 'NO';
  makerTick?: string;
  orderId?: string;
  makerOrderId?: string;
};

export function useSoothBookFeed(
  soothBookAddress: `0x${string}` | undefined,
  marketKey: `0x${string}` | undefined,
) {
  const publicClient = usePublicClient();
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!publicClient || !soothBookAddress || !marketKey) return;
    setIsLoading(true);
    try {
      const latest = await publicClient.getBlockNumber();
      const from = latest > 10000n ? latest - 10000n : 0n;
      const [placed, placedV2, filled, filledV2, cancelled, cancelledV2] = await Promise.all([
        publicClient.getLogs({
          address: soothBookAddress,
          event: ORDER_PLACED,
          args: { marketKey },
          fromBlock: from,
          toBlock: 'latest',
        }),
        publicClient.getLogs({
          address: soothBookAddress,
          event: ORDER_PLACED_V2,
          args: { marketKey },
          fromBlock: from,
          toBlock: 'latest',
        }),
        publicClient.getLogs({
          address: soothBookAddress,
          event: ORDER_FILLED,
          args: { marketKey },
          fromBlock: from,
          toBlock: 'latest',
        }),
        publicClient.getLogs({
          address: soothBookAddress,
          event: ORDER_FILLED_V2,
          args: { marketKey },
          fromBlock: from,
          toBlock: 'latest',
        }),
        publicClient.getLogs({
          address: soothBookAddress,
          event: ORDER_CANCELLED,
          args: { marketKey },
          fromBlock: from,
          toBlock: 'latest',
        }),
        publicClient.getLogs({
          address: soothBookAddress,
          event: ORDER_CANCELLED_V2,
          args: { marketKey },
          fromBlock: from,
          toBlock: 'latest',
        }),
      ]);

      const items: FeedItem[] = [];

      for (const log of placed) {
        const side = Number(log.args.side) === 1 ? 'YES' : 'NO';
        items.push({
          id: `${log.transactionHash}-${log.logIndex}-p`,
          type: 'placed',
          side,
          tick: String(log.args.tick),
          amount: log.args.amount ?? 0n,
          who: log.args.maker as `0x${string}`,
          block: log.blockNumber ?? 0n,
          logIndex: Number(log.logIndex),
        });
      }

      for (const log of placedV2) {
        const side = Number(log.args.side) === 1 ? 'YES' : 'NO';
        items.push({
          id: `${log.transactionHash}-${log.logIndex}-p2`,
          type: 'placed',
          side,
          tick: String(log.args.tick),
          amount: log.args.amount ?? 0n,
          who: log.args.maker as `0x${string}`,
          block: log.blockNumber ?? 0n,
          logIndex: Number(log.logIndex),
          orderId: String(log.args.orderId ?? ''),
        });
      }

      for (const log of filled) {
        const takerSide = Number(log.args.takerSide);
        const side = takerSide === 1 ? 'YES' : 'NO';
        const makerSide = takerSide === 1 ? 'NO' : 'YES';
        const makerTick = takerSide === 1 ? String(log.args.noTick) : String(log.args.yesTick);
        items.push({
          id: `${log.transactionHash}-${log.logIndex}-f`,
          type: 'filled',
          side,
          tick: `${log.args.yesTick}/${log.args.noTick}`,
          amount: log.args.amount ?? 0n,
          who: log.args.taker as `0x${string}`,
          block: log.blockNumber ?? 0n,
          logIndex: Number(log.logIndex),
          maker: log.args.maker as `0x${string}`,
          makerSide,
          makerTick,
        });
      }

      for (const log of filledV2) {
        const takerSide = Number(log.args.takerSide);
        const side = takerSide === 1 ? 'YES' : 'NO';
        const makerSide = takerSide === 1 ? 'NO' : 'YES';
        const makerTick = takerSide === 1 ? String(log.args.noTick) : String(log.args.yesTick);
        items.push({
          id: `${log.transactionHash}-${log.logIndex}-f2`,
          type: 'filled',
          side,
          tick: `${log.args.yesTick}/${log.args.noTick}`,
          amount: log.args.amount ?? 0n,
          who: log.args.taker as `0x${string}`,
          block: log.blockNumber ?? 0n,
          logIndex: Number(log.logIndex),
          maker: log.args.maker as `0x${string}`,
          makerSide,
          makerTick,
          makerOrderId: String(log.args.makerOrderId ?? ''),
        });
      }

      for (const log of cancelled) {
        const side = Number(log.args.side) === 1 ? 'YES' : 'NO';
        items.push({
          id: `${log.transactionHash}-${log.logIndex}-c`,
          type: 'cancelled',
          side,
          tick: String(log.args.tick),
          amount: log.args.amount ?? 0n,
          who: log.args.maker as `0x${string}`,
          block: log.blockNumber ?? 0n,
          logIndex: Number(log.logIndex),
        });
      }

      for (const log of cancelledV2) {
        const side = Number(log.args.side) === 1 ? 'YES' : 'NO';
        items.push({
          id: `${log.transactionHash}-${log.logIndex}-c2`,
          type: 'cancelled',
          side,
          tick: String(log.args.tick),
          amount: log.args.amount ?? 0n,
          who: log.args.maker as `0x${string}`,
          block: log.blockNumber ?? 0n,
          logIndex: Number(log.logIndex),
          orderId: String(log.args.orderId ?? ''),
        });
      }

      const deduped = new Map<string, FeedItem>();
      for (const item of items) {
        const baseType = item.type;
        const key = `${item.block.toString()}-${item.logIndex}-${baseType}`;
        const existing = deduped.get(key);
        if (!existing) {
          deduped.set(key, item);
          continue;
        }
        const existingHasV2 = Boolean(existing.orderId || existing.makerOrderId);
        const currentHasV2 = Boolean(item.orderId || item.makerOrderId);
        if (!existingHasV2 && currentHasV2) {
          deduped.set(key, item);
        }
      }

      const finalItems = Array.from(deduped.values());
      finalItems.sort((a, b) => {
        if (a.block === b.block) return b.logIndex - a.logIndex;
        return a.block > b.block ? -1 : 1;
      });
      setFeed(finalItems);
    } catch {
      toast.error('Failed to load activity');
    } finally {
      setIsLoading(false);
    }
  }, [publicClient, soothBookAddress, marketKey]);

  return { feed, isLoading, refresh };
}
