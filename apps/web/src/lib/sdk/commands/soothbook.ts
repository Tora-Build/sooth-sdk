import { encodeFunctionData, formatUnits, parseAbiItem, type Address } from 'viem';
import type { SDKContext, CommandResult, OutputLine } from '../types';
import { ABIS } from '../../../config/abis';
import { formatWad, parseWad, error, success, plain, info, warn, bold, dim, separator } from '../utils';

const TEST_MARKETS: readonly `0x${string}`[] = [
  '0x28a722c5a9f901c47dda06574bb57ede6fc256dfbb821a7f17cae915b511fb3b',
  '0x1b7e3a5e85ec8aaa17e7e7918496fd0b4637cf54a87cf3d031ebe50b8576f515',
  '0x8881374938b0170c9fefd869f43721a62c145c48e3686f0494c51e5b44cdcf35',
];

const NO_SIDE = 0;
const YES_SIDE = 1;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const USER_SCAN_CHUNK_SIZE = 400_000n;
const DEFAULT_HISTORY_PAGE_SIZE = 50;

const CHAIN_START_BLOCKS: Record<number, bigint> = {
  84532: 37_890_676n,
  10143: 13_700_000n,
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

type HistoryFeedItem = {
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

type HistoryEntry = {
  key: string;
  orderId: string;
  side: 'YES' | 'NO';
  priceCents: string;
  size: string;
  refundAmount: string;
  event: 'Placed' | 'Filled' | 'Cancelled';
  sortKey: number;
};

function formatPriceFromTick(tick: number): string {
  return (tick / 1000).toFixed(3);
}

function formatOutcome(outcome: number): string {
  if (outcome === 0) return 'NO';
  if (outcome === 1) return 'YES';
  if (outcome === 2) return 'INVALID';
  return `UNKNOWN(${outcome})`;
}

function parseTick(tickArg: string): number {
  const tick = Number.parseInt(tickArg, 10);
  if (!Number.isFinite(tick) || tick < 1 || tick > 999) {
    throw new Error('Tick must be an integer between 1 and 999');
  }
  return tick;
}

function parseSide(sideArg: string): number {
  const side = sideArg.toLowerCase();
  if (side === 'yes') return YES_SIDE;
  if (side === 'no') return NO_SIDE;
  throw new Error('Side must be yes or no');
}

function parseEscrow(escrowArg?: string): boolean {
  if (!escrowArg) return false;
  const value = escrowArg.toLowerCase();
  return value === 'true' || value === 'escrow' || value === '1';
}

function parseOptionalMaxCost(maxCostArg?: string): bigint {
  if (!maxCostArg) return 0n;
  return parseWad(maxCostArg);
}

function parseMarketKeyInput(arg: string): `0x${string}` {
  if (arg.startsWith('0x')) {
    if (arg.length !== 66) {
      throw new Error('Market key must be a 32-byte hex string');
    }
    return arg as `0x${string}`;
  }

  const index = Number.parseInt(arg, 10);
  if (!Number.isFinite(index) || index < 0 || index >= TEST_MARKETS.length) {
    throw new Error(`Market index out of range (0-${TEST_MARKETS.length - 1})`);
  }
  return TEST_MARKETS[index];
}

function parseHistoryPagination(args: string[]): { page: number; pageSize: number } {
  const rawPage = args[0] ? Number.parseInt(args[0], 10) : 1;
  const rawPageSize = args[1] ? Number.parseInt(args[1], 10) : DEFAULT_HISTORY_PAGE_SIZE;
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const pageSize = Number.isFinite(rawPageSize)
    ? Math.max(1, Math.min(200, rawPageSize))
    : DEFAULT_HISTORY_PAGE_SIZE;
  return { page, pageSize };
}

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

function isCanonicalOrderId(orderId?: string): orderId is string {
  return Boolean(orderId && /^\d+$/.test(orderId));
}

function getTxHashFromFeedItemId(id: string): string | null {
  const [txHash] = id.split('-');
  return /^0x[a-fA-F0-9]{64}$/.test(txHash) ? txHash : null;
}

function getHistoryRef(item: HistoryFeedItem): string {
  const txHash = getTxHashFromFeedItemId(item.id);
  if (txHash) return txHash;
  return `block-${item.block.toString()}-${item.logIndex}`;
}

function shortRef(value: string): string {
  if (!value) return '—';
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function getLevelKey(side: 'YES' | 'NO', tick: string): string {
  return `${side === 'YES' ? 1 : 0}:${tick}`;
}

function getPlacedSignature(item: HistoryFeedItem): string | null {
  if (item.type !== 'placed') return null;
  const txHash = getTxHashFromFeedItemId(item.id);
  if (!txHash) return null;
  return `${txHash}:${item.who.toLowerCase()}:${item.side}:${item.tick}:${item.amount.toString()}`;
}

function getCancelledSignature(item: HistoryFeedItem): string | null {
  if (item.type !== 'cancelled') return null;
  const txHash = getTxHashFromFeedItemId(item.id);
  if (!txHash) return null;
  return `${txHash}:${item.who.toLowerCase()}:${item.side}:${item.tick}:${item.amount.toString()}`;
}

function getMakerFillSignature(item: HistoryFeedItem): string | null {
  if (item.type !== 'filled' || !item.maker || !item.makerSide || !item.makerTick) return null;
  const txHash = getTxHashFromFeedItemId(item.id);
  if (!txHash) return null;
  return `${txHash}:${item.maker.toLowerCase()}:${item.makerSide}:${item.makerTick}:${item.amount.toString()}`;
}

function getTakerFillSignature(item: HistoryFeedItem): string | null {
  if (item.type !== 'filled') return null;
  const txHash = getTxHashFromFeedItemId(item.id);
  if (!txHash) return null;
  return `${txHash}:${item.who.toLowerCase()}:${item.side}:${item.tick}:${item.amount.toString()}`;
}

function getYesPriceFromSingleTick(side: 'YES' | 'NO', tick: string): number {
  const parsedTick = Number(tick);
  if (!Number.isFinite(parsedTick)) return 0;
  return side === 'YES' ? parsedTick / 1000 : (1000 - parsedTick) / 1000;
}

function getYesPriceForHistory(item: HistoryFeedItem, side: 'YES' | 'NO'): number {
  if (item.tick.includes('/')) {
    const [yesRaw, noRaw] = item.tick.split('/');
    const yesTick = Number(yesRaw);
    const noTick = Number(noRaw);
    if (side === 'YES') return Number.isFinite(yesTick) ? yesTick / 1000 : 0;
    return Number.isFinite(noTick) ? (1000 - noTick) / 1000 : 0;
  }
  return getYesPriceFromSingleTick(side, item.tick);
}

function formatSidePriceCents(yesPrice: number, side: 'YES' | 'NO'): string {
  const sidePrice = side === 'YES' ? yesPrice : (1 - yesPrice);
  return `${(sidePrice * 100).toFixed(1)}¢`;
}

function formatRefundAmountWad(refundAmountWad: bigint | null): string {
  if (!refundAmountWad || refundAmountWad <= 0n) return '—';
  const asNumber = Number(formatUnits(refundAmountWad, 18));
  if (!Number.isFinite(asNumber)) return '—';
  return `$${asNumber.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function toEventLabel(type: HistoryFeedItem['type']): 'Placed' | 'Filled' | 'Cancelled' {
  if (type === 'placed') return 'Placed';
  if (type === 'filled') return 'Filled';
  return 'Cancelled';
}

async function readMarket(ctx: SDKContext, soothBook: Address, marketKey: `0x${string}`) {
  const { config } = ctx;
  return config.publicClient.readContract({
    address: soothBook,
    abi: ABIS.SoothBook,
    functionName: 'markets',
    args: [marketKey],
  }) as Promise<[Address, Address, Address, boolean, boolean, number]>;
}

async function fetchUserHistoryFeed(
  ctx: SDKContext,
  soothBook: Address,
  marketKey: `0x${string}`,
  owner: `0x${string}`,
): Promise<HistoryFeedItem[]> {
  const { config } = ctx;
  const latest = await config.publicClient.getBlockNumber();
  const fallbackStart = latest > 2_000_000n ? latest - 2_000_000n : 0n;
  const startBlock = CHAIN_START_BLOCKS[config.chainId] ?? fallbackStart;
  const ranges = getScanRanges(startBlock, latest, USER_SCAN_CHUNK_SIZE);

  const placed: Array<any> = [];
  const placedV2: Array<any> = [];
  const filled: Array<any> = [];
  const filledV2: Array<any> = [];
  const cancelled: Array<any> = [];
  const cancelledV2: Array<any> = [];

  for (const range of ranges) {
    const [chunkPlaced, chunkPlacedV2, chunkFilledAsTaker, chunkFilledV2AsTaker, chunkFilledAsMaker, chunkFilledV2AsMaker, chunkCancelled, chunkCancelledV2] = await Promise.all([
      config.publicClient.getLogs({
        address: soothBook,
        event: ORDER_PLACED,
        args: { marketKey, maker: owner },
        fromBlock: range.from,
        toBlock: range.to,
      }),
      config.publicClient.getLogs({
        address: soothBook,
        event: ORDER_PLACED_V2,
        args: { marketKey, maker: owner },
        fromBlock: range.from,
        toBlock: range.to,
      }),
      config.publicClient.getLogs({
        address: soothBook,
        event: ORDER_FILLED,
        args: { marketKey, taker: owner },
        fromBlock: range.from,
        toBlock: range.to,
      }),
      config.publicClient.getLogs({
        address: soothBook,
        event: ORDER_FILLED_V2,
        args: { marketKey, taker: owner },
        fromBlock: range.from,
        toBlock: range.to,
      }),
      config.publicClient.getLogs({
        address: soothBook,
        event: ORDER_FILLED,
        args: { marketKey, maker: owner },
        fromBlock: range.from,
        toBlock: range.to,
      }),
      config.publicClient.getLogs({
        address: soothBook,
        event: ORDER_FILLED_V2,
        args: { marketKey, maker: owner },
        fromBlock: range.from,
        toBlock: range.to,
      }),
      config.publicClient.getLogs({
        address: soothBook,
        event: ORDER_CANCELLED,
        args: { marketKey, maker: owner },
        fromBlock: range.from,
        toBlock: range.to,
      }),
      config.publicClient.getLogs({
        address: soothBook,
        event: ORDER_CANCELLED_V2,
        args: { marketKey, maker: owner },
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

  const items: HistoryFeedItem[] = [];

  for (const log of placed) {
    const side = Number(log.args.side) === 1 ? 'YES' : 'NO';
    items.push({
      id: `${log.transactionHash}-${log.logIndex}-p`,
      type: 'placed',
      side,
      tick: String(log.args.tick),
      amount: log.args.amount ?? 0n,
      escrow: Boolean(log.args.escrow),
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
      escrow: Boolean(log.args.escrow),
      who: log.args.maker as `0x${string}`,
      block: log.blockNumber ?? 0n,
      logIndex: Number(log.logIndex),
      orderId: String(log.args.orderId ?? ''),
    });
  }

  for (const log of filled) {
    const takerSide = Number(log.args.takerSide);
    const side = takerSide === 1 ? 'YES' : 'NO';
    const makerSide: 'YES' | 'NO' = takerSide === 1 ? 'NO' : 'YES';
    const makerTick = takerSide === 1 ? String(log.args.noTick) : String(log.args.yesTick);
    items.push({
      id: `${log.transactionHash}-${log.logIndex}-f`,
      type: 'filled',
      side,
      tick: `${log.args.yesTick}/${log.args.noTick}`,
      amount: log.args.amount ?? 0n,
      surplus: log.args.surplus ?? 0n,
      who: log.args.taker as `0x${string}`,
      maker: log.args.maker as `0x${string}`,
      makerSide,
      makerTick,
      block: log.blockNumber ?? 0n,
      logIndex: Number(log.logIndex),
    });
  }

  for (const log of filledV2) {
    const takerSide = Number(log.args.takerSide);
    const side = takerSide === 1 ? 'YES' : 'NO';
    const makerSide: 'YES' | 'NO' = takerSide === 1 ? 'NO' : 'YES';
    const makerTick = takerSide === 1 ? String(log.args.noTick) : String(log.args.yesTick);
    items.push({
      id: `${log.transactionHash}-${log.logIndex}-f2`,
      type: 'filled',
      side,
      tick: `${log.args.yesTick}/${log.args.noTick}`,
      amount: log.args.amount ?? 0n,
      surplus: log.args.surplus ?? 0n,
      who: log.args.taker as `0x${string}`,
      maker: log.args.maker as `0x${string}`,
      makerSide,
      makerTick,
      makerOrderId: String(log.args.makerOrderId ?? ''),
      block: log.blockNumber ?? 0n,
      logIndex: Number(log.logIndex),
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

  const deduped = new Map<string, HistoryFeedItem>();
  for (const item of items) {
    const key = `${item.block.toString()}-${item.logIndex}-${item.type}`;
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
  return finalItems;
}

function buildHistoryEntries(feed: HistoryFeedItem[], userLower: string): HistoryEntry[] {
  const placedEscrowByOrderId = new Map<string, boolean>();
  const placedEscrowByLevel = new Map<string, boolean | 'mixed'>();
  for (const item of feed) {
    if (item.type !== 'placed') continue;
    if (item.who.toLowerCase() !== userLower) continue;

    const escrow = Boolean(item.escrow);
    if (isCanonicalOrderId(item.orderId)) {
      placedEscrowByOrderId.set(item.orderId, escrow);
      continue;
    }

    const key = getLevelKey(item.side, item.tick);
    const existing = placedEscrowByLevel.get(key);
    if (existing === undefined) {
      placedEscrowByLevel.set(key, escrow);
    } else if (existing !== escrow) {
      placedEscrowByLevel.set(key, 'mixed');
    }
  }

  const deduped = new Map<string, { row: HistoryEntry; canonical: boolean }>();
  for (const item of feed) {
    const isUserEvent = item.who.toLowerCase() === userLower;
    const isMakerEvent = item.type === 'filled' && item.maker?.toLowerCase() === userLower;
    if (!isUserEvent && !isMakerEvent) continue;

    const isMakerFill = item.type === 'filled' && isMakerEvent && item.makerSide !== undefined;
    const side: 'YES' | 'NO' = isMakerFill ? item.makerSide! : item.side;
    const orderId = item.type === 'filled'
      ? (isMakerFill && isCanonicalOrderId(item.makerOrderId) ? item.makerOrderId : '')
      : (isCanonicalOrderId(item.orderId) ? item.orderId : '');

    const dedupeKey = item.type === 'placed'
      ? (getPlacedSignature(item) ?? item.id)
      : item.type === 'cancelled'
        ? (getCancelledSignature(item) ?? item.id)
        : isMakerFill
          ? (getMakerFillSignature(item) ?? item.id)
          : (getTakerFillSignature(item) ?? item.id);

    const canonical = item.type === 'filled'
      ? (isMakerFill && isCanonicalOrderId(item.makerOrderId))
      : isCanonicalOrderId(item.orderId);

    let refundAmountWad: bigint | null = null;
    if (item.type === 'filled' && isUserEvent) {
      refundAmountWad = item.surplus && item.surplus > 0n ? item.surplus : null;
    } else if (item.type === 'cancelled') {
      const tick = Number.parseInt(item.tick, 10);
      const escrowForOrder = orderId
        ? placedEscrowByOrderId.get(orderId)
        : placedEscrowByLevel.get(getLevelKey(item.side, item.tick));
      if (Number.isFinite(tick) && escrowForOrder === false) {
        refundAmountWad = (BigInt(tick) * item.amount) / 1000n;
      }
    }

    const yesPrice = getYesPriceForHistory(item, side);
    const size = Number(formatUnits(item.amount, 18));
    const row: HistoryEntry = {
      key: item.id,
      orderId: orderId || shortRef(getHistoryRef(item)),
      side,
      priceCents: formatSidePriceCents(yesPrice, side),
      size: Number.isFinite(size) ? size.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0',
      refundAmount: formatRefundAmountWad(refundAmountWad),
      event: toEventLabel(item.type),
      sortKey: Number(item.block) * 10_000 + item.logIndex,
    };

    const existing = deduped.get(dedupeKey);
    if (!existing || (canonical && !existing.canonical)) {
      deduped.set(dedupeKey, { row, canonical });
    }
  }

  return Array.from(deduped.values())
    .map((entry) => entry.row)
    .sort((a, b) => b.sortKey - a.sortKey);
}

export async function buyyes(ctx: SDKContext, args: string[]): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config, address, marketKey } = ctx;
  if (!address || !config.walletClient) {
    return { result: { success: false, message: 'No wallet connected' }, output: [error('No wallet connected')] };
  }
  const soothBook = config.contracts.SoothBook;
  if (!soothBook) {
    return { result: { success: false, message: 'SoothBook not configured' }, output: [error('SoothBook not available on this chain')] };
  }
  if (!marketKey) {
    return { result: { success: false, message: 'No market selected' }, output: [error('No market selected. Use: sbsetmarket <key>')] };
  }
  if (args.length < 2) {
    return { result: { success: false, message: 'Usage: buyyes <tick> <amount> [escrow] [maxCost]' }, output: [error('Usage: buyyes <tick> <amount> [escrow] [maxCost]')] };
  }

  try {
    const tick = parseTick(args[0]);
    const amount = parseWad(args[1]);
    const escrow = parseEscrow(args[2]);
    const maxCost = parseOptionalMaxCost(args[3]);

    const hash = await config.walletClient.sendTransaction({
      account: address,
      to: soothBook,
      data: encodeFunctionData({
        abi: ABIS.SoothBook,
        functionName: 'buyYes',
        args: [marketKey, tick, amount, escrow, maxCost],
      }),
      chain: null,
    } as Parameters<typeof config.walletClient.sendTransaction>[0]);

    await config.publicClient.waitForTransactionReceipt({ hash });

    return {
      result: { success: true, txHash: hash },
      output: [success(`Bought YES at tick ${tick} (${formatPriceFromTick(tick)}) for ${formatWad(amount)} (escrow=${escrow ? 'yes' : 'no'})`)],
    };
  } catch (err) {
    return { result: { success: false, message: (err as Error).message }, output: [error(`buyyes failed: ${(err as Error).message}`)] };
  }
}

export async function buyno(ctx: SDKContext, args: string[]): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config, address, marketKey } = ctx;
  if (!address || !config.walletClient) {
    return { result: { success: false, message: 'No wallet connected' }, output: [error('No wallet connected')] };
  }
  const soothBook = config.contracts.SoothBook;
  if (!soothBook) {
    return { result: { success: false, message: 'SoothBook not configured' }, output: [error('SoothBook not available on this chain')] };
  }
  if (!marketKey) {
    return { result: { success: false, message: 'No market selected' }, output: [error('No market selected. Use: sbsetmarket <key>')] };
  }
  if (args.length < 2) {
    return { result: { success: false, message: 'Usage: buyno <tick> <amount> [escrow] [maxCost]' }, output: [error('Usage: buyno <tick> <amount> [escrow] [maxCost]')] };
  }

  try {
    const tick = parseTick(args[0]);
    const amount = parseWad(args[1]);
    const escrow = parseEscrow(args[2]);
    const maxCost = parseOptionalMaxCost(args[3]);

    const hash = await config.walletClient.sendTransaction({
      account: address,
      to: soothBook,
      data: encodeFunctionData({
        abi: ABIS.SoothBook,
        functionName: 'buyNo',
        args: [marketKey, tick, amount, escrow, maxCost],
      }),
      chain: null,
    } as Parameters<typeof config.walletClient.sendTransaction>[0]);

    await config.publicClient.waitForTransactionReceipt({ hash });

    return {
      result: { success: true, txHash: hash },
      output: [success(`Bought NO at tick ${tick} (${formatPriceFromTick(tick)}) for ${formatWad(amount)} (escrow=${escrow ? 'yes' : 'no'})`)],
    };
  } catch (err) {
    return { result: { success: false, message: (err as Error).message }, output: [error(`buyno failed: ${(err as Error).message}`)] };
  }
}

export async function sbmint(ctx: SDKContext, args: string[]): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config, address, marketKey } = ctx;
  if (!address || !config.walletClient) {
    return { result: { success: false, message: 'No wallet connected' }, output: [error('No wallet connected')] };
  }
  const soothBook = config.contracts.SoothBook;
  if (!soothBook) {
    return { result: { success: false, message: 'SoothBook not configured' }, output: [error('SoothBook not available on this chain')] };
  }
  if (!marketKey) {
    return { result: { success: false, message: 'No market selected' }, output: [error('No market selected. Use: sbsetmarket <key>')] };
  }
  if (args.length < 1) {
    return { result: { success: false, message: 'Usage: sbmint <amount>' }, output: [error('Usage: sbmint <amount>')] };
  }

  try {
    const amount = parseWad(args[0]);

    const hash = await config.walletClient.sendTransaction({
      account: address,
      to: soothBook,
      data: encodeFunctionData({
        abi: ABIS.SoothBook,
        functionName: 'mint',
        args: [marketKey, amount],
      }),
      chain: null,
    } as Parameters<typeof config.walletClient.sendTransaction>[0]);

    await config.publicClient.waitForTransactionReceipt({ hash });

    return {
      result: { success: true, txHash: hash },
      output: [success(`Minted ${formatWad(amount)} YES+NO sets`)],
    };
  } catch (err) {
    return { result: { success: false, message: (err as Error).message }, output: [error(`sbmint failed: ${(err as Error).message}`)] };
  }
}

export async function sbmerge(ctx: SDKContext, args: string[]): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config, address, marketKey } = ctx;
  if (!address || !config.walletClient) {
    return { result: { success: false, message: 'No wallet connected' }, output: [error('No wallet connected')] };
  }
  const soothBook = config.contracts.SoothBook;
  if (!soothBook) {
    return { result: { success: false, message: 'SoothBook not configured' }, output: [error('SoothBook not available on this chain')] };
  }
  if (!marketKey) {
    return { result: { success: false, message: 'No market selected' }, output: [error('No market selected. Use: sbsetmarket <key>')] };
  }
  if (args.length < 1) {
    return { result: { success: false, message: 'Usage: sbmerge <amount>' }, output: [error('Usage: sbmerge <amount>')] };
  }

  try {
    const amount = parseWad(args[0]);

    const hash = await config.walletClient.sendTransaction({
      account: address,
      to: soothBook,
      data: encodeFunctionData({
        abi: ABIS.SoothBook,
        functionName: 'merge',
        args: [marketKey, amount],
      }),
      chain: null,
    } as Parameters<typeof config.walletClient.sendTransaction>[0]);

    await config.publicClient.waitForTransactionReceipt({ hash });

    return {
      result: { success: true, txHash: hash },
      output: [success(`Merged ${formatWad(amount)} YES+NO sets into collateral`)],
    };
  } catch (err) {
    return { result: { success: false, message: (err as Error).message }, output: [error(`sbmerge failed: ${(err as Error).message}`)] };
  }
}

export async function sbcancel(ctx: SDKContext, args: string[]): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config, address, marketKey } = ctx;
  if (!address || !config.walletClient) {
    return { result: { success: false, message: 'No wallet connected' }, output: [error('No wallet connected')] };
  }
  const soothBook = config.contracts.SoothBook;
  if (!soothBook) {
    return { result: { success: false, message: 'SoothBook not configured' }, output: [error('SoothBook not available on this chain')] };
  }
  if (!marketKey) {
    return { result: { success: false, message: 'No market selected' }, output: [error('No market selected. Use: sbsetmarket <key>')] };
  }
  if (args.length < 2) {
    return { result: { success: false, message: 'Usage: sbcancel <side> <tick>' }, output: [error('Usage: sbcancel <yes|no> <tick>')] };
  }

  try {
    const side = parseSide(args[0]);
    const tick = parseTick(args[1]);

    const hash = await config.walletClient.sendTransaction({
      account: address,
      to: soothBook,
      data: encodeFunctionData({
        abi: ABIS.SoothBook,
        functionName: 'cancel',
        args: [marketKey, side, tick],
      }),
      chain: null,
    } as Parameters<typeof config.walletClient.sendTransaction>[0]);

    await config.publicClient.waitForTransactionReceipt({ hash });

    return {
      result: { success: true, txHash: hash },
      output: [success(`Cancelled ${side === YES_SIDE ? 'YES' : 'NO'} order at tick ${tick}`)],
    };
  } catch (err) {
    return { result: { success: false, message: (err as Error).message }, output: [error(`sbcancel failed: ${(err as Error).message}`)] };
  }
}

export async function sbredeem(ctx: SDKContext, args: string[]): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config, address, marketKey } = ctx;
  if (!address || !config.walletClient) {
    return { result: { success: false, message: 'No wallet connected' }, output: [error('No wallet connected')] };
  }
  const soothBook = config.contracts.SoothBook;
  if (!soothBook) {
    return { result: { success: false, message: 'SoothBook not configured' }, output: [error('SoothBook not available on this chain')] };
  }
  if (!marketKey) {
    return { result: { success: false, message: 'No market selected' }, output: [error('No market selected. Use: sbsetmarket <key>')] };
  }
  if (args.length > 0) {
    return { result: { success: false, message: 'Usage: sbredeem' }, output: [error('Usage: sbredeem')] };
  }

  try {
    const hash = await config.walletClient.sendTransaction({
      account: address,
      to: soothBook,
      data: encodeFunctionData({
        abi: ABIS.SoothBook,
        functionName: 'redeem',
        args: [marketKey],
      }),
      chain: null,
    } as Parameters<typeof config.walletClient.sendTransaction>[0]);

    await config.publicClient.waitForTransactionReceipt({ hash });

    return {
      result: { success: true, txHash: hash },
      output: [success('Redeem submitted')],
    };
  } catch (err) {
    return { result: { success: false, message: (err as Error).message }, output: [error(`sbredeem failed: ${(err as Error).message}`)] };
  }
}

async function scanSideTopTicks(
  ctx: SDKContext,
  soothBook: Address,
  marketKey: `0x${string}`,
  side: number,
  depth = 10
): Promise<Array<{ tick: number; totalAmount: bigint; orderCount: bigint }>> {
  const { config } = ctx;
  const rows: Array<{ tick: number; totalAmount: bigint; orderCount: bigint }> = [];

  let currentTick = await config.publicClient.readContract({
    address: soothBook,
    abi: ABIS.SoothBook,
    functionName: 'getBestTick',
    args: [marketKey, side],
  }) as number;

  if (currentTick < 1 || currentTick > 999) {
    return rows;
  }

  while (currentTick >= 1 && rows.length < depth) {
    const [totalAmount, orderCount] = await config.publicClient.readContract({
      address: soothBook,
      abi: ABIS.SoothBook,
      functionName: 'getOrdersAtTick',
      args: [marketKey, side, currentTick],
    }) as [bigint, bigint];

    if (totalAmount > 0n || orderCount > 0n) {
      rows.push({ tick: currentTick, totalAmount, orderCount });
    }

    currentTick -= 1;
  }

  return rows;
}

export async function sbbook(ctx: SDKContext, args: string[]): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config, marketKey } = ctx;
  const soothBook = config.contracts.SoothBook;
  if (!soothBook) {
    return { result: { success: false, message: 'SoothBook not configured' }, output: [error('SoothBook not available on this chain')] };
  }
  if (!marketKey) {
    return { result: { success: false, message: 'No market selected' }, output: [error('No market selected. Use: sbsetmarket <key>')] };
  }
  if (args.length > 0) {
    return { result: { success: false, message: 'Usage: sbbook' }, output: [error('Usage: sbbook')] };
  }

  try {
    const [yesRows, noRows] = await Promise.all([
      scanSideTopTicks(ctx, soothBook, marketKey, YES_SIDE, 10),
      scanSideTopTicks(ctx, soothBook, marketKey, NO_SIDE, 10),
    ]);

    const output: OutputLine[] = [
      plain(''),
      bold('SoothBook Orderbook'),
      separator(76),
      info('YES side (top ticks)'),
      plain('  tick   price    total amount               orders'),
    ];

    if (yesRows.length === 0) {
      output.push(dim('  (no YES orders found)'));
    } else {
      for (const row of yesRows) {
        output.push(plain(`  ${row.tick.toString().padStart(4)}   ${formatPriceFromTick(row.tick).padEnd(5)}    ${formatWad(row.totalAmount).padStart(24)}   ${row.orderCount.toString().padStart(6)}`));
      }
    }

    output.push(plain(''));
    output.push(warn('NO side (top ticks)'));
    output.push(plain('  tick   price    total amount               orders'));

    if (noRows.length === 0) {
      output.push(dim('  (no NO orders found)'));
    } else {
      for (const row of noRows) {
        output.push(plain(`  ${row.tick.toString().padStart(4)}   ${formatPriceFromTick(row.tick).padEnd(5)}    ${formatWad(row.totalAmount).padStart(24)}   ${row.orderCount.toString().padStart(6)}`));
      }
    }

    output.push(plain(''));

    return { result: { success: true, data: { yesRows, noRows } }, output };
  } catch (err) {
    return { result: { success: false, message: (err as Error).message }, output: [error(`sbbook failed: ${(err as Error).message}`)] };
  }
}

export async function sbbalance(ctx: SDKContext, args: string[]): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config, address, marketKey } = ctx;
  const soothBook = config.contracts.SoothBook;
  if (!soothBook) {
    return { result: { success: false, message: 'SoothBook not configured' }, output: [error('SoothBook not available on this chain')] };
  }
  if (!marketKey) {
    return { result: { success: false, message: 'No market selected' }, output: [error('No market selected. Use: sbsetmarket <key>')] };
  }
  if (!address) {
    return { result: { success: false, message: 'No wallet connected' }, output: [error('No wallet connected')] };
  }
  if (args.length > 0) {
    return { result: { success: false, message: 'Usage: sbbalance' }, output: [error('Usage: sbbalance')] };
  }

  try {
    const [yes, no] = await config.publicClient.readContract({
      address: soothBook,
      abi: ABIS.SoothBook,
      functionName: 'getBalance',
      args: [marketKey, address],
    }) as [bigint, bigint];

    return {
      result: { success: true, data: { yes, no } },
      output: [
        plain(''),
        bold('SoothBook Balance'),
        separator(50),
        info(`YES: ${formatWad(yes)}`),
        warn(`NO:  ${formatWad(no)}`),
        plain(''),
      ],
    };
  } catch (err) {
    return { result: { success: false, message: (err as Error).message }, output: [error(`sbbalance failed: ${(err as Error).message}`)] };
  }
}

export async function sbstate(ctx: SDKContext, args: string[]): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config, marketKey } = ctx;
  const soothBook = config.contracts.SoothBook;
  if (!soothBook) {
    return { result: { success: false, message: 'SoothBook not configured' }, output: [error('SoothBook not available on this chain')] };
  }
  if (!marketKey) {
    return { result: { success: false, message: 'No market selected' }, output: [error('No market selected. Use: sbsetmarket <key>')] };
  }
  if (args.length > 0) {
    return { result: { success: false, message: 'Usage: sbstate' }, output: [error('Usage: sbstate')] };
  }

  try {
    const [market, implied, backing] = await Promise.all([
      config.publicClient.readContract({
        address: soothBook,
        abi: ABIS.SoothBook,
        functionName: 'markets',
        args: [marketKey],
      }) as Promise<[Address, Address, Address, boolean, boolean, number]>,
      config.publicClient.readContract({
        address: soothBook,
        abi: ABIS.SoothBook,
        functionName: 'getImpliedPrice',
        args: [marketKey],
      }) as Promise<[bigint, bigint]>,
      config.publicClient.readContract({
        address: soothBook,
        abi: ABIS.SoothBook,
        functionName: 'getCollateralBacking',
        args: [marketKey],
      }) as Promise<bigint>,
    ]);

    const [collateral, yesToken, noToken, active, finalized, outcome] = market;
    const [yesPrice, noPrice] = implied;

    return {
      result: {
        success: true,
        data: { collateral, yesToken, noToken, active, finalized, outcome, yesPrice, noPrice, backing },
      },
      output: [
        plain(''),
        bold('SoothBook Market State'),
        separator(76),
        plain(`Market Key:  ${marketKey}`),
        plain(`Collateral:  ${collateral}`),
        plain(`YES Token:   ${yesToken}`),
        plain(`NO Token:    ${noToken}`),
        plain(`Active:      ${active ? 'YES' : 'NO'}`),
        plain(`Finalized:   ${finalized ? 'YES' : 'NO'}`),
        plain(`Outcome:     ${formatOutcome(outcome)}`),
        plain(`YES Price:   ${formatWad(yesPrice)}`),
        plain(`NO Price:    ${formatWad(noPrice)}`),
        plain(`Backing:     ${formatWad(backing)}`),
        plain(''),
      ],
    };
  } catch (err) {
    return { result: { success: false, message: (err as Error).message }, output: [error(`sbstate failed: ${(err as Error).message}`)] };
  }
}

export async function sbprice(ctx: SDKContext, args: string[]): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config, marketKey } = ctx;
  const soothBook = config.contracts.SoothBook;
  if (!soothBook) {
    return { result: { success: false, message: 'SoothBook not configured' }, output: [error('SoothBook not available on this chain')] };
  }
  if (!marketKey) {
    return { result: { success: false, message: 'No market selected' }, output: [error('No market selected. Use: sbsetmarket <key>')] };
  }
  if (args.length > 0) {
    return { result: { success: false, message: 'Usage: sbprice' }, output: [error('Usage: sbprice')] };
  }

  try {
    const [yesPrice, noPrice] = await config.publicClient.readContract({
      address: soothBook,
      abi: ABIS.SoothBook,
      functionName: 'getImpliedPrice',
      args: [marketKey],
    }) as [bigint, bigint];

    return {
      result: { success: true, data: { yesPrice, noPrice } },
      output: [
        plain(''),
        bold('SoothBook Implied Price'),
        separator(50),
        info(`YES: ${formatWad(yesPrice)}`),
        warn(`NO:  ${formatWad(noPrice)}`),
        plain(''),
      ],
    };
  } catch (err) {
    return { result: { success: false, message: (err as Error).message }, output: [error(`sbprice failed: ${(err as Error).message}`)] };
  }
}

export async function sbhistory(ctx: SDKContext, args: string[]): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config, marketKey, address } = ctx;
  const soothBook = config.contracts.SoothBook;
  if (!soothBook) {
    return { result: { success: false, message: 'SoothBook not configured' }, output: [error('SoothBook not available on this chain')] };
  }
  if (!marketKey) {
    return { result: { success: false, message: 'No market selected' }, output: [error('No market selected. Use: sbsetmarket <key>')] };
  }
  if (!address) {
    return { result: { success: false, message: 'No wallet connected' }, output: [error('No wallet connected')] };
  }
  if (args.length > 2) {
    return { result: { success: false, message: 'Usage: sbhistory [page] [pageSize]' }, output: [error('Usage: sbhistory [page] [pageSize]')] };
  }

  try {
    const { page, pageSize } = parseHistoryPagination(args);
    const feed = await fetchUserHistoryFeed(ctx, soothBook, marketKey, address);
    const entries = buildHistoryEntries(feed, address.toLowerCase());
    const total = entries.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    const paged = entries.slice(start, start + pageSize);

    const output: OutputLine[] = [
      plain(''),
      bold('SoothBook Order History'),
      separator(98),
      plain(`Page ${safePage}/${totalPages} • Showing ${paged.length} of ${total}`),
      dim('Refund Amt = taker surplus on fills, or returned collateral on non-escrow cancels.'),
      plain('ID           Side  Price    Size                  Refund Amt           Event'),
    ];

    if (paged.length === 0) {
      output.push(dim('No order history for connected wallet.'));
    } else {
      for (const row of paged) {
        output.push(
          plain(
            `${row.orderId.padEnd(12)} ${row.side.padEnd(4)}  ${row.priceCents.padStart(6)}  ${row.size.padStart(20)}  ${row.refundAmount.padStart(18)}   ${row.event}`,
          ),
        );
      }
    }

    output.push(plain(''));

    return {
      result: { success: true, data: { page: safePage, pageSize, total, totalPages, rows: paged } },
      output,
    };
  } catch (err) {
    return { result: { success: false, message: (err as Error).message }, output: [error(`sbhistory failed: ${(err as Error).message}`)] };
  }
}

export async function sbsetmarket(ctx: SDKContext, args: string[]): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config } = ctx;
  const soothBook = config.contracts.SoothBook;
  if (!soothBook) {
    return { result: { success: false, message: 'SoothBook not configured' }, output: [error('SoothBook not available on this chain')] };
  }
  if (args.length < 1) {
    return { result: { success: false, message: 'Usage: sbsetmarket <key|index>' }, output: [error('Usage: sbsetmarket <key|index>')] };
  }

  try {
    const marketKey = parseMarketKeyInput(args[0]);
    const [collateral, yesToken, noToken, active, finalized, outcome] = await readMarket(ctx, soothBook, marketKey);

    if (collateral.toLowerCase() === ZERO_ADDRESS) {
      return { result: { success: false, message: 'Market not found' }, output: [error('Market not found in SoothBook')] };
    }

    ctx.marketKey = marketKey;

    return {
      result: { success: true, data: { marketKey, active, finalized, outcome } },
      output: [
        success(`SoothBook market selected: ${marketKey}`),
        plain(`Collateral: ${collateral}`),
        plain(`YES Token:  ${yesToken}`),
        plain(`NO Token:   ${noToken}`),
        plain(`Active:     ${active ? 'YES' : 'NO'}`),
        plain(`Finalized:  ${finalized ? 'YES' : 'NO'}`),
        plain(`Outcome:    ${formatOutcome(outcome)}`),
      ],
    };
  } catch (err) {
    return { result: { success: false, message: (err as Error).message }, output: [error(`sbsetmarket failed: ${(err as Error).message}`)] };
  }
}

export const soothbookCommands = {
  buyyes,
  buyno,
  sbmint,
  sbmerge,
  sbcancel,
  sbredeem,
  sbbook,
  sbbalance,
  sbstate,
  sbprice,
  sbhistory,
  sbsetmarket,
};
