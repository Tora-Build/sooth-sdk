import type { CommandContext, CommandResult } from './types';
import { formatUnits, parseAbiItem } from 'viem';
import { ABIS } from '../config';
import {
  bold,
  dim,
  formatWad,
  info,
  parseWad,
  printTable,
  readContractWithRpcFallback,
  shortAddress,
  success,
  warn,
} from '../cli-utils';

const DEFAULT_SCAN_CHUNK_SIZE = 400_000n;
const DEFAULT_HISTORY_PAGE_SIZE = 50;
const DEFAULT_HISTORY_LOOKBACK_BLOCKS = 100_000n;
const HISTORY_RANGE_CONCURRENCY = 3;

// Chain-specific log scan chunk sizes (some RPCs limit range)
const CHAIN_SCAN_CHUNKS: Record<number, bigint> = {
  10143: 900n, // Monad: eth_getLogs limited to 1,000 range
  37111: 10_000n, // Lens: conservative
  998: 9_000n, // HyperEVM Testnet: 10k cap
  6343: 9_000n, // MegaETH Testnet: 10k cap
};

const CHAIN_HISTORY_LOOKBACK_BLOCKS: Record<number, bigint> = {
  84532: 200_000n,
  10143: 20_000n,
  37111: 50_000n,
};

const ORDER_PLACED = parseAbiItem(
  'event OrderPlaced(bytes32 indexed marketKey, uint8 side, uint16 tick, address indexed maker, uint128 amount, bool escrow, uint64 orderId)',
);
const ORDER_FILLED = parseAbiItem(
  'event OrderFilled(bytes32 indexed marketKey, uint8 takerSide, uint16 yesTick, uint16 noTick, address indexed taker, address indexed maker, uint128 amount, uint256 surplus, uint64 makerOrderId)',
);
const ORDER_CANCELLED = parseAbiItem(
  'event OrderCancelled(bytes32 indexed marketKey, uint8 side, uint16 tick, address indexed maker, uint128 amount, uint64 orderId)',
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
  orderId: string;
  side: 'YES' | 'NO';
  priceCents: string;
  size: string;
  refundAmount: string;
  event: 'Placed' | 'Filled' | 'Cancelled';
  sortKey: number;
};

function requireSoothBook(ctx: CommandContext): `0x${string}` | null {
  const soothBook = ctx.deployment.contracts.SoothBook;
  return soothBook ? (soothBook as `0x${string}`) : null;
}

function requireMarketKey(ctx: CommandContext): `0x${string}` | null {
  return ctx.marketKey;
}

function parseTickValue(input: string): number {
  const tick = Number.parseInt(input, 10);
  if (!Number.isInteger(tick) || tick < 0 || tick > 65535) {
    throw new Error(`Invalid tick: ${input}`);
  }
  return tick;
}

function parseEscrow(input?: string): boolean {
  if (!input) return false;
  const normalized = input.toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'y';
}

function parseSide(input: string): number {
  const normalized = input.toLowerCase();
  if (normalized === 'yes' || normalized === '1') return 1;
  if (normalized === 'no' || normalized === '0') return 0;
  throw new Error(`Invalid side: ${input}. Use yes|no`);
}

function _parseOutcome(input: string): number {
  const normalized = input.toLowerCase();
  if (normalized === 'no' || normalized === '0') return 0;
  if (normalized === 'yes' || normalized === '1') return 1;
  if (normalized === 'invalid' || normalized === '2') return 2;
  throw new Error(`Invalid outcome: ${input}. Use no|yes|invalid`);
}

function _outcomeLabel(outcome: number): string {
  if (outcome === 0) return 'NO';
  if (outcome === 1) return 'YES';
  if (outcome === 2) return 'INVALID';
  return `UNKNOWN(${outcome})`;
}

function parseHistoryPagination(args: string[]): {
  page: number;
  pageSize: number;
} {
  const rawPage = args[0] ? Number.parseInt(args[0], 10) : 1;
  const rawPageSize = args[1] ? Number.parseInt(args[1], 10) : DEFAULT_HISTORY_PAGE_SIZE;
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const pageSize = Number.isFinite(rawPageSize)
    ? Math.max(1, Math.min(200, rawPageSize))
    : DEFAULT_HISTORY_PAGE_SIZE;
  return { page, pageSize };
}

function getScanRanges(
  fromBlock: bigint,
  toBlock: bigint,
  chunkSize: bigint,
): Array<{ from: bigint; to: bigint }> {
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
  const parts = id.split(':');
  const txHash = parts.length >= 3 ? parts[1] : id.split('-')[0];
  return /^0x[a-fA-F0-9]{64}$/.test(txHash) ? txHash : null;
}

function getEventIdentity(chainId: number, txHash: string, logIndex: number): string {
  return `${chainId}:${txHash}:${logIndex}`;
}

function shortRef(value: string): string {
  if (!value) return '—';
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function getHistoryRef(item: HistoryFeedItem): string {
  const txHash = getTxHashFromFeedItemId(item.id);
  if (txHash) return txHash;
  return `block-${item.block.toString()}-${item.logIndex}`;
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
  const sidePrice = side === 'YES' ? yesPrice : 1 - yesPrice;
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

async function waitForTx(ctx: CommandContext, hash: `0x${string}`): Promise<void> {
  const publicClient = ctx.actorManager.getPublicClient();
  await publicClient.waitForTransactionReceipt({
    hash,
    confirmations: ctx.config.confirmations,
  });
}

async function fetchUserHistoryFeed(
  ctx: CommandContext,
  soothBook: `0x${string}`,
  marketKey: `0x${string}`,
  owner: `0x${string}`,
): Promise<{
  items: HistoryFeedItem[];
  fromBlock: bigint;
  toBlock: bigint;
}> {
  const publicClient = ctx.actorManager.getPublicClient();
  const latest = await publicClient.getBlockNumber();
  const lookback =
    CHAIN_HISTORY_LOOKBACK_BLOCKS[ctx.config.chain.id] ?? DEFAULT_HISTORY_LOOKBACK_BLOCKS;
  const windowStart = latest > lookback ? latest - lookback : 0n;
  const deploymentStart = BigInt(ctx.deployment.startBlock ?? 0);
  const startBlock = deploymentStart > windowStart ? deploymentStart : windowStart;
  const chunkSize = CHAIN_SCAN_CHUNKS[ctx.config.chain.id] ?? DEFAULT_SCAN_CHUNK_SIZE;
  const ranges = getScanRanges(startBlock, latest, chunkSize);

  const placed: Array<any> = [];
  const filled: Array<any> = [];
  const cancelled: Array<any> = [];

  for (let offset = 0; offset < ranges.length; offset += HISTORY_RANGE_CONCURRENCY) {
    const batch = await Promise.all(
      ranges.slice(offset, offset + HISTORY_RANGE_CONCURRENCY).map(async (range) =>
        Promise.all([
          publicClient.getLogs({
            address: soothBook,
            event: ORDER_PLACED,
            args: { marketKey, maker: owner },
            fromBlock: range.from,
            toBlock: range.to,
          }),
          publicClient.getLogs({
            address: soothBook,
            event: ORDER_FILLED,
            args: { marketKey, taker: owner },
            fromBlock: range.from,
            toBlock: range.to,
          }),
          publicClient.getLogs({
            address: soothBook,
            event: ORDER_FILLED,
            args: { marketKey, maker: owner },
            fromBlock: range.from,
            toBlock: range.to,
          }),
          publicClient.getLogs({
            address: soothBook,
            event: ORDER_CANCELLED,
            args: { marketKey, maker: owner },
            fromBlock: range.from,
            toBlock: range.to,
          }),
        ]),
      ),
    );

    for (const [chunkPlaced, chunkFilledAsTaker, chunkFilledAsMaker, chunkCancelled] of batch) {
      placed.push(...chunkPlaced);
      filled.push(...chunkFilledAsTaker, ...chunkFilledAsMaker);
      cancelled.push(...chunkCancelled);
    }
  }

  const items: HistoryFeedItem[] = [];

  for (const log of placed) {
    const side = Number(log.args.side) === 1 ? 'YES' : 'NO';
    items.push({
      id: getEventIdentity(ctx.config.chain.id, log.transactionHash, Number(log.logIndex)),
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
      id: getEventIdentity(ctx.config.chain.id, log.transactionHash, Number(log.logIndex)),
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
      id: getEventIdentity(ctx.config.chain.id, log.transactionHash, Number(log.logIndex)),
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
  return { items: finalItems, fromBlock: startBlock, toBlock: latest };
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
    const orderId =
      item.type === 'filled'
        ? isMakerFill && isCanonicalOrderId(item.makerOrderId)
          ? item.makerOrderId
          : ''
        : isCanonicalOrderId(item.orderId)
          ? item.orderId
          : '';

    const dedupeKey =
      item.type === 'placed'
        ? (getPlacedSignature(item) ?? item.id)
        : item.type === 'cancelled'
          ? (getCancelledSignature(item) ?? item.id)
          : isMakerFill
            ? (getMakerFillSignature(item) ?? item.id)
            : (getTakerFillSignature(item) ?? item.id);

    const canonical =
      item.type === 'filled'
        ? isMakerFill && isCanonicalOrderId(item.makerOrderId)
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
      orderId: orderId || shortRef(getHistoryRef(item)),
      side,
      priceCents: formatSidePriceCents(yesPrice, side),
      size: Number.isFinite(size)
        ? size.toLocaleString(undefined, { maximumFractionDigits: 0 })
        : '0',
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

export async function buyyes(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  if (args.length < 2) {
    return {
      success: false,
      message: 'Usage: buyyes <tick> <amount> [escrow] [maxcost]',
    };
  }

  const deployment = ctx.deployment;
  const marketKey = requireMarketKey(ctx);
  const soothBook = requireSoothBook(ctx);
  const walletClient = ctx.actorManager.currentWalletClient();

  if (!walletClient) return { success: false, message: 'No actor selected' };
  if (!marketKey)
    return {
      success: false,
      message: 'No market selected. Use: setmarket <key>',
    };
  if (!soothBook)
    return {
      success: false,
      message: 'SoothBook address not found in deployment',
    };

  try {
    const tick = parseTickValue(args[0]);
    const amount = parseWad(args[1]);
    const escrow = parseEscrow(args[2]);
    const matchLimit = args[3] ? Number(args[3]) : 0;

    const hash = await walletClient.writeContract({
      address: deployment.contracts.SoothBook as `0x${string}`,
      abi: ABIS.SoothBook,
      functionName: 'buyYes',
      args: [marketKey, tick, amount, escrow, matchLimit],
    });
    await waitForTx(ctx, hash);

    console.log(success(`  ✓ Placed YES order at ${tick / 10}% for ${formatWad(amount)} shares`));
    return { success: true, txHash: hash };
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
}

export async function buyno(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  if (args.length < 2) {
    return {
      success: false,
      message: 'Usage: buyno <tick> <amount> [escrow] [maxcost]',
    };
  }

  const deployment = ctx.deployment;
  const marketKey = requireMarketKey(ctx);
  const soothBook = requireSoothBook(ctx);
  const walletClient = ctx.actorManager.currentWalletClient();

  if (!walletClient) return { success: false, message: 'No actor selected' };
  if (!marketKey)
    return {
      success: false,
      message: 'No market selected. Use: setmarket <key>',
    };
  if (!soothBook)
    return {
      success: false,
      message: 'SoothBook address not found in deployment',
    };

  try {
    const tick = parseTickValue(args[0]);
    const amount = parseWad(args[1]);
    const escrow = parseEscrow(args[2]);
    const matchLimit = args[3] ? Number(args[3]) : 0;

    const hash = await walletClient.writeContract({
      address: deployment.contracts.SoothBook as `0x${string}`,
      abi: ABIS.SoothBook,
      functionName: 'buyNo',
      args: [marketKey, tick, amount, escrow, matchLimit],
    });
    await waitForTx(ctx, hash);

    console.log(success(`  ✓ Placed NO order at ${tick / 10}% for ${formatWad(amount)} shares`));
    return { success: true, txHash: hash };
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
}

export async function mint(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  if (args.length < 1) {
    return { success: false, message: 'Usage: mint <amount>' };
  }

  const marketKey = requireMarketKey(ctx);
  const soothBook = requireSoothBook(ctx);
  const walletClient = ctx.actorManager.currentWalletClient();

  if (!walletClient) return { success: false, message: 'No actor selected' };
  if (!marketKey)
    return {
      success: false,
      message: 'No market selected. Use: setmarket <key>',
    };
  if (!soothBook)
    return {
      success: false,
      message: 'SoothBook address not found in deployment',
    };

  try {
    const amount = parseWad(args[0]);
    const hash = await walletClient.writeContract({
      address: soothBook,
      abi: ABIS.SoothBook,
      functionName: 'mint',
      args: [marketKey, amount],
    });
    await waitForTx(ctx, hash);

    console.log(success(`  ✓ Minted ${formatWad(amount)} complete sets (YES+NO)`));
    return { success: true, txHash: hash };
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
}

export async function merge(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  if (args.length < 1) {
    return { success: false, message: 'Usage: merge <amount>' };
  }

  const marketKey = requireMarketKey(ctx);
  const soothBook = requireSoothBook(ctx);
  const walletClient = ctx.actorManager.currentWalletClient();

  if (!walletClient) return { success: false, message: 'No actor selected' };
  if (!marketKey)
    return {
      success: false,
      message: 'No market selected. Use: setmarket <key>',
    };
  if (!soothBook)
    return {
      success: false,
      message: 'SoothBook address not found in deployment',
    };

  try {
    const amount = parseWad(args[0]);
    const hash = await walletClient.writeContract({
      address: soothBook,
      abi: ABIS.SoothBook,
      functionName: 'merge',
      args: [marketKey, amount],
    });
    await waitForTx(ctx, hash);

    console.log(success(`  ✓ Merged ${formatWad(amount)} sets -> USDC returned`));
    return { success: true, txHash: hash };
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
}

export async function cancel(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  if (args.length < 2) {
    return { success: false, message: 'Usage: cancel <side> <tick>' };
  }

  const marketKey = requireMarketKey(ctx);
  const soothBook = requireSoothBook(ctx);
  const walletClient = ctx.actorManager.currentWalletClient();

  if (!walletClient) return { success: false, message: 'No actor selected' };
  if (!marketKey)
    return {
      success: false,
      message: 'No market selected. Use: setmarket <key>',
    };
  if (!soothBook)
    return {
      success: false,
      message: 'SoothBook address not found in deployment',
    };

  try {
    const side = parseSide(args[0]);
    const tick = parseTickValue(args[1]);
    const hash = await walletClient.writeContract({
      address: soothBook,
      abi: ABIS.SoothBook,
      functionName: 'cancel',
      args: [marketKey, side, tick],
    });
    await waitForTx(ctx, hash);

    const sideText = side === 1 ? 'YES' : 'NO';
    console.log(success(`  ✓ Cancelled order at ${sideText} tick ${tick}`));
    return { success: true, txHash: hash };
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
}

// sbredeem: warn-stub since v0.2.1.
// SoothBook.redeem(bytes32) was deleted upstream — redemption now flows through
// OrderEngine.redeem(market, outcome, amount) on a different command path.
export async function redeem(_ctx: CommandContext, _args: string[]): Promise<CommandResult> {
  return {
    success: false,
    message:
      'sbredeem deprecated in v0.2.1: SoothBook.redeem was deleted. Use the OrderEngine redeem path (OrderEngine.redeem(market, outcome, amount)).',
  };
}

// sbresolve: warn-stub since v0.2.1.
// SoothBook.resolveMarket(bytes32, uint8) was deleted upstream — resolution now
// flows through the adjudicator lifecycle: setmarket then marketstatus / settle.
export async function resolve(_ctx: CommandContext, _args: string[]): Promise<CommandResult> {
  return {
    success: false,
    message:
      'sbresolve deprecated in v0.2.1: SoothBook.resolveMarket was deleted. Use the adjudicator lifecycle instead — setmarket, then marketstatus / settle / finalize.',
  };
}

export async function book(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  const marketKey = requireMarketKey(ctx);
  const soothBook = requireSoothBook(ctx);
  if (!marketKey)
    return {
      success: false,
      message: 'No market selected. Use: setmarket <key>',
    };
  if (!soothBook)
    return {
      success: false,
      message: 'SoothBook address not found in deployment',
    };

  try {
    // v0.2.1: SoothBook.markets(bytes32) was deleted. Gate on the new
    // registeredMarkets(bytes32)→bool instead.
    const isRegistered = await readContractWithRpcFallback<boolean>(
      ctx.config.chain,
      ctx.config.rpc,
      {
        address: soothBook,
        abi: ABIS.SoothBook,
        functionName: 'registeredMarkets',
        args: [marketKey],
      },
    ).catch(() => false);

    if (!isRegistered) {
      return {
        success: false,
        message: `Market not registered in SoothBook (orderbook). This is an AMM-only market — try: marketstatus`,
      };
    }

    const center = args[0]
      ? Math.max(0, Math.min(65535, Number.parseInt(args[0], 10) || 500))
      : 500;
    const window = args[1] ? Math.max(1, Math.min(200, Number.parseInt(args[1], 10) || 10)) : 10;
    const start = Math.max(0, center - window);
    const end = center + window;

    const [bestYesTick, bestNoTick, implied] = await Promise.all([
      readContractWithRpcFallback<number>(ctx.config.chain, ctx.config.rpc, {
        address: soothBook,
        abi: ABIS.SoothBook,
        functionName: 'getBestTick',
        args: [marketKey, 1],
      }),
      readContractWithRpcFallback<number>(ctx.config.chain, ctx.config.rpc, {
        address: soothBook,
        abi: ABIS.SoothBook,
        functionName: 'getBestTick',
        args: [marketKey, 0],
      }),
      readContractWithRpcFallback<readonly [bigint, bigint]>(ctx.config.chain, ctx.config.rpc, {
        address: soothBook,
        abi: ABIS.SoothBook,
        functionName: 'getImpliedPriceByKey',
        args: [marketKey],
      }),
    ]);

    console.log(`\n  ${bold('SoothBook')} ${dim(`[center=${center}, window=${window}]`)}`);
    console.log(
      `  Best YES Tick: ${info(String(bestYesTick))} | Best NO Tick: ${warn(String(bestNoTick))}`,
    );
    console.log(
      `  Implied Price: YES ${(Number(implied[0]) / 1e16).toFixed(2)}% | NO ${(Number(implied[1]) / 1e16).toFixed(2)}%`,
    );
    console.log('');

    const rows: string[][] = [];
    for (let tick = start; tick <= end; tick++) {
      const [yesAtTick, noAtTick] = await Promise.all([
        readContractWithRpcFallback<readonly [bigint, bigint]>(ctx.config.chain, ctx.config.rpc, {
          address: soothBook,
          abi: ABIS.SoothBook,
          functionName: 'getOrdersAtTick',
          args: [marketKey, 1, tick],
        }),
        readContractWithRpcFallback<readonly [bigint, bigint]>(ctx.config.chain, ctx.config.rpc, {
          address: soothBook,
          abi: ABIS.SoothBook,
          functionName: 'getOrdersAtTick',
          args: [marketKey, 0, tick],
        }),
      ]);

      const hasLiquidity =
        yesAtTick[0] > 0n || noAtTick[0] > 0n || yesAtTick[1] > 0n || noAtTick[1] > 0n;
      const tickLabel = hasLiquidity ? success(`*${tick}`) : `${tick}`;
      rows.push([
        tickLabel,
        yesAtTick[1].toString(),
        formatWad(yesAtTick[0]),
        noAtTick[1].toString(),
        formatWad(noAtTick[0]),
      ]);
    }

    printTable(
      ['TICK', 'YES orders', 'YES amount', 'NO orders', 'NO amount'],
      rows,
      [8, 12, 14, 12, 14],
    );
    console.log('');

    return { success: true };
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
}

export async function state(ctx: CommandContext, _args: string[]): Promise<CommandResult> {
  const marketKey = requireMarketKey(ctx);
  const soothBook = requireSoothBook(ctx);
  if (!marketKey)
    return {
      success: false,
      message: 'No market selected. Use: setmarket <key>',
    };
  if (!soothBook)
    return {
      success: false,
      message: 'SoothBook address not found in deployment',
    };

  // v0.2.1: SoothBook.markets(bytes32) was deleted. The collateral / YES / NO
  // token addresses + finalized + outcome no longer live on SoothBook —
  // collateral/YES/NO read from the deployment manifest, finalized + outcome
  // moved to TruthMarket. Use registeredMarkets(bytes32)→bool as the gate.
  const isRegistered = await readContractWithRpcFallback<boolean>(
    ctx.config.chain,
    ctx.config.rpc,
    {
      address: soothBook,
      abi: ABIS.SoothBook,
      functionName: 'registeredMarkets',
      args: [marketKey],
    },
  ).catch(() => false);

  if (!isRegistered) {
    return {
      success: false,
      message: `Market not registered in SoothBook (orderbook). This is an AMM-only market — try: marketstatus`,
    };
  }

  try {
    const [collateralBacking, bestNoTick, bestYesTick, impliedPrice] = await Promise.all([
      readContractWithRpcFallback<bigint>(ctx.config.chain, ctx.config.rpc, {
        address: soothBook,
        abi: ABIS.SoothBook,
        functionName: 'getCollateralBacking',
        args: [marketKey],
      }),
      readContractWithRpcFallback<number>(ctx.config.chain, ctx.config.rpc, {
        address: soothBook,
        abi: ABIS.SoothBook,
        functionName: 'getBestTick',
        args: [marketKey, 0],
      }),
      readContractWithRpcFallback<number>(ctx.config.chain, ctx.config.rpc, {
        address: soothBook,
        abi: ABIS.SoothBook,
        functionName: 'getBestTick',
        args: [marketKey, 1],
      }),
      readContractWithRpcFallback<readonly [bigint, bigint]>(ctx.config.chain, ctx.config.rpc, {
        address: soothBook,
        abi: ABIS.SoothBook,
        functionName: 'getImpliedPriceByKey',
        args: [marketKey],
      }),
    ]);
    console.log(`\n  ${bold('Market State')}`);
    console.log('  ' + '-'.repeat(56));
    console.log(`  Market Key:      ${marketKey}`);
    console.log(`  Registered:      ${success('true')}`);
    console.log(`  Collateral Back: ${formatWad(collateralBacking)} USDC`);
    console.log(`  Best YES Tick:   ${bestYesTick}`);
    console.log(`  Best NO Tick:    ${bestNoTick}`);
    console.log(
      `  Implied Price:   YES ${(Number(impliedPrice[0]) / 1e16).toFixed(2)}% | NO ${(Number(impliedPrice[1]) / 1e16).toFixed(2)}%`,
    );
    console.log(`  ${dim('finalized/outcome moved to TruthMarket — use marketstatus')}`);
    console.log('');

    return { success: true };
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
}

export async function positions(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  const marketKey = requireMarketKey(ctx);
  const soothBook = requireSoothBook(ctx);

  if (!marketKey)
    return {
      success: false,
      message: 'No market selected. Use: setmarket <key>',
    };
  if (!soothBook)
    return {
      success: false,
      message: 'SoothBook address not found in deployment',
    };

  try {
    let targets = ctx.actorManager.listActors().map((actor) => ({
      name: actor.name,
      address: actor.account.address,
    }));
    if (args.length > 0) {
      const actor = ctx.actorManager.getActor(args[0]);
      if (actor) {
        targets = [{ name: actor.name, address: actor.account.address }];
      } else if (args[0].startsWith('0x') && args[0].length === 42) {
        const addr = args[0] as `0x${string}`;
        targets = [{ name: shortAddress(addr), address: addr }];
      } else {
        return { success: false, message: `Unknown actor/address: ${args[0]}` };
      }
    }

    if (targets.length === 0) {
      return { success: false, message: 'No actors loaded' };
    }

    const rows: string[][] = [];
    for (const actor of targets) {
      const address = actor.address;
      const [position, walletUsdc] = await Promise.all([
        readContractWithRpcFallback<readonly [bigint, bigint]>(ctx.config.chain, ctx.config.rpc, {
          address: soothBook,
          abi: ABIS.SoothBook,
          functionName: 'getBalance',
          args: [marketKey, address],
        }),
        readContractWithRpcFallback<bigint>(ctx.config.chain, ctx.config.rpc, {
          address: ctx.deployment.contracts.BaseToken as `0x${string}`,
          abi: ABIS.BaseToken,
          functionName: 'balanceOf',
          args: [address],
        }),
      ]);

      rows.push([
        actor.name,
        shortAddress(address),
        formatWad(walletUsdc),
        formatWad(position[0]),
        formatWad(position[1]),
      ]);
    }

    console.log(`\n  ${bold('Positions')}`);
    printTable(['Actor', 'Address', 'USDC', 'YES', 'NO'], rows, [12, 14, 12, 12, 12]);
    console.log('');

    return { success: true };
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
}

export async function history(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  if (args.length > 2) {
    return { success: false, message: 'Usage: history [page] [pageSize]' };
  }

  const marketKey = requireMarketKey(ctx);
  const soothBook = requireSoothBook(ctx);
  const actor = ctx.actorManager.currentActor();

  if (!actor) return { success: false, message: 'No actor selected' };
  if (!marketKey)
    return {
      success: false,
      message: 'No market selected. Use: setmarket <key>',
    };
  if (!soothBook)
    return {
      success: false,
      message: 'SoothBook address not found in deployment',
    };

  try {
    const { page, pageSize } = parseHistoryPagination(args);
    const address = actor.account.address;
    const feed = await fetchUserHistoryFeed(ctx, soothBook, marketKey, address);
    const entries = buildHistoryEntries(feed.items, address.toLowerCase());
    const total = entries.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    const paged = entries.slice(start, start + pageSize);

    console.log(`\n  ${bold('Order History')} ${dim(`(${actor.name})`)}`);
    console.log(`  Page ${safePage}/${totalPages} • Showing ${paged.length} of ${total}`);
    console.log(
      `  ${dim(`Source: RPC • completeness: windowed • blocks ${feed.fromBlock}-${feed.toBlock}`)}`,
    );
    console.log(
      `  ${dim('Refund Amt = taker surplus on fills, or returned collateral on non-escrow cancels.')}`,
    );

    if (paged.length === 0) {
      console.log(`  ${dim('No order history for selected actor.')}`);
      console.log('');
      return {
        success: true,
        data: {
          page: safePage,
          pageSize,
          total,
          totalPages,
          rows: [],
          source: 'rpc',
          completeness: 'windowed',
          fromBlock: feed.fromBlock.toString(),
          toBlock: feed.toBlock.toString(),
        },
      };
    }

    const rows = paged.map((row) => [
      row.orderId,
      row.side,
      row.priceCents,
      row.size,
      row.refundAmount,
      row.event,
    ]);

    printTable(
      ['ID', 'SIDE', 'PRICE', 'SIZE', 'REFUND AMT', 'EVENT'],
      rows,
      [14, 6, 8, 14, 14, 12],
    );
    console.log('');

    return {
      success: true,
      data: {
        page: safePage,
        pageSize,
        total,
        totalPages,
        rows: paged,
        source: 'rpc',
        completeness: 'windowed',
        fromBlock: feed.fromBlock.toString(),
        toBlock: feed.toBlock.toString(),
      },
    };
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
}

export const soothbookCommands: Record<
  string,
  (ctx: CommandContext, args: string[]) => Promise<CommandResult>
> = {
  buyyes,
  buyno,
  mint,
  merge,
  cancel,
  redeem,
  resolve,
  book,
  state,
  positions,
  history,
};
