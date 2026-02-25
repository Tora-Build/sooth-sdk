import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { parseAbiItem } from 'viem';
import { usePublicClient } from 'wagmi';

const DEFAULT_LOOKBACK_BLOCKS = 10_000n;
const USER_SCAN_CHUNK_SIZE = 2_000n;

const CHAIN_START_BLOCKS: Record<number, bigint> = {
  84532: 36_399_046n,
  10143: 6_558_931n,
  5042002: 21_983_342n,
  6343: 8_855_921n,
};

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
  escrow?: boolean;
  surplus?: bigint;
  maker?: `0x${string}`;
  makerSide?: 'YES' | 'NO';
  makerTick?: string;
  orderId?: string;
  makerOrderId?: string;
};

type UseSoothBookFeedOptions = {
  owner?: `0x${string}`;
};

function getScanRanges(fromBlock: bigint, toBlock: bigint, chunkSize: bigint): Array<{ from: bigint; to: bigint }> {
  if (toBlock < fromBlock) return [];

  const ranges: Array<{ from: bigint; to: bigint }> = [];
  let start = fromBlock;

  while (start <= toBlock) {
    const end = start + chunkSize - 1n;
    ranges.push({ from: start, to: end > toBlock ? toBlock : end });
    start = end + 1n;
  }

  return ranges;
}

export function useSoothBookFeed(
  soothBookAddress: `0x${string}` | undefined,
  marketKey: `0x${string}` | undefined,
  options?: UseSoothBookFeedOptions,
) {
  const publicClient = usePublicClient();
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const owner = options?.owner;

  const refresh = useCallback(async () => {
    if (!publicClient || !soothBookAddress || !marketKey) return;
    setIsLoading(true);
    try {
      const latest = await publicClient.getBlockNumber();

      let placed: Awaited<ReturnType<typeof publicClient.getLogs<typeof ORDER_PLACED>>> = [];
      let placedV2: Awaited<ReturnType<typeof publicClient.getLogs<typeof ORDER_PLACED_V2>>> = [];
      let filled: Awaited<ReturnType<typeof publicClient.getLogs<typeof ORDER_FILLED>>> = [];
      let filledV2: Awaited<ReturnType<typeof publicClient.getLogs<typeof ORDER_FILLED_V2>>> = [];
      let cancelled: Awaited<ReturnType<typeof publicClient.getLogs<typeof ORDER_CANCELLED>>> = [];
      let cancelledV2: Awaited<ReturnType<typeof publicClient.getLogs<typeof ORDER_CANCELLED_V2>>> = [];

      const ownerLower = owner?.toLowerCase() as `0x${string}` | undefined;
      if (!ownerLower) {
        const from = latest > DEFAULT_LOOKBACK_BLOCKS ? latest - DEFAULT_LOOKBACK_BLOCKS : 0n;
        [placed, placedV2, filled, filledV2, cancelled, cancelledV2] = await Promise.all([
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
      } else {
        const chainId = publicClient.chain?.id;
        const fallbackStart = latest > 2_000_000n ? latest - 2_000_000n : 0n;
        const startBlock = CHAIN_START_BLOCKS[chainId ?? 0] ?? fallbackStart;
        const ranges = getScanRanges(startBlock, latest, USER_SCAN_CHUNK_SIZE);

        for (const range of ranges) {
          const [chunkPlaced, chunkPlacedV2, chunkFilledAsTaker, chunkFilledV2AsTaker, chunkFilledAsMaker, chunkFilledV2AsMaker, chunkCancelled, chunkCancelledV2] = await Promise.all([
            publicClient.getLogs({
              address: soothBookAddress,
              event: ORDER_PLACED,
              args: { marketKey, maker: ownerLower },
              fromBlock: range.from,
              toBlock: range.to,
            }),
            publicClient.getLogs({
              address: soothBookAddress,
              event: ORDER_PLACED_V2,
              args: { marketKey, maker: ownerLower },
              fromBlock: range.from,
              toBlock: range.to,
            }),
            publicClient.getLogs({
              address: soothBookAddress,
              event: ORDER_FILLED,
              args: { marketKey, taker: ownerLower },
              fromBlock: range.from,
              toBlock: range.to,
            }),
            publicClient.getLogs({
              address: soothBookAddress,
              event: ORDER_FILLED_V2,
              args: { marketKey, taker: ownerLower },
              fromBlock: range.from,
              toBlock: range.to,
            }),
            publicClient.getLogs({
              address: soothBookAddress,
              event: ORDER_FILLED,
              args: { marketKey, maker: ownerLower },
              fromBlock: range.from,
              toBlock: range.to,
            }),
            publicClient.getLogs({
              address: soothBookAddress,
              event: ORDER_FILLED_V2,
              args: { marketKey, maker: ownerLower },
              fromBlock: range.from,
              toBlock: range.to,
            }),
            publicClient.getLogs({
              address: soothBookAddress,
              event: ORDER_CANCELLED,
              args: { marketKey, maker: ownerLower },
              fromBlock: range.from,
              toBlock: range.to,
            }),
            publicClient.getLogs({
              address: soothBookAddress,
              event: ORDER_CANCELLED_V2,
              args: { marketKey, maker: ownerLower },
              fromBlock: range.from,
              toBlock: range.to,
            }),
          ]);

          placed.push(...chunkPlaced);
          placedV2.push(...chunkPlacedV2);
          filled.push(...chunkFilledAsTaker, ...chunkFilledAsMaker);
          filledV2.push(...chunkFilledV2AsTaker, ...chunkFilledV2AsMaker);
          cancelled.push(...chunkCancelled);
          cancelledV2.push(...chunkCancelledV2);
        }
      }

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
          escrow: Boolean(log.args.escrow),
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
          escrow: Boolean(log.args.escrow),
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
          surplus: log.args.surplus ?? 0n,
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
          surplus: log.args.surplus ?? 0n,
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
  }, [publicClient, soothBookAddress, marketKey, owner]);

  return { feed, isLoading, refresh };
}
