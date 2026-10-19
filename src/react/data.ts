/** Display reads for the widget. Indexed figures are never signing authority; planners re-read the chain. */
import { erc20Abi, formatUnits, type Address } from 'viem';
import {
  assertMarketBinding,
  factoryMarketScope,
  factoryReadClient,
  readFactoryMarketSnapshot,
  readFactoryQuote,
  type FactoryNodeContext,
  type FactoryReadClient,
} from '../factory/factoryClient.js';
import { getFactoryAbis } from '../factory/factoryAbi/index.js';
import {
  fetchFactoryFills,
  fetchFactoryIndexedDepth,
  fetchFactoryPrices,
} from '../factory/factoryIndexer.js';
import { readFactoryLiquidityQuote } from '../factory/factoryLifecycle.js';
import {
  discoverFactoryLpPositions,
  factoryEventClient,
  readFactoryBookDepth,
  readFactoryEntitlements,
  type FactoryBookLevel,
  type FactoryLpPosition,
} from '../factory/factoryPortfolio.js';
import type { FactoryTransactionAction } from '../factory/factoryTransactions.js';
import { freshReceiptBlock } from '../factory/factoryTrade/afterReceipt.js';
import {
  formatTokenRounded,
  tokenShortfall,
  wadToNativeCeil,
  wadToNativeFloor,
} from '../factory/factoryTrade/amounts.js';
import { bookBuyCashNative, centsToTick, yesAxisTick } from '../factory/factoryTrade/bookOrder.js';
import { allocateBookFee } from '../factory/factoryTrade/fees.js';
import { planTokenApproval } from '../factory/factoryTrade/tokenApproval.js';
import { describeSoothError } from './errors.js';
import {
  readSoothMarket,
  type SoothMarketData,
  type SoothResolvedMarket,
  type SoothResolvedNode,
} from './runtime.js';
import {
  checkNewExposure,
  sharesAmount,
  type SoothTradeIntent,
  type SoothTradePreview,
} from './trading.js';

const WAD = 10n ** 18n;
const probability = (wad: bigint) => Number(wad) / 1e18;

/** The time range a chart shows; bucket width is chosen per range. */
export type SoothChartInterval = '5m' | '1h' | '1d' | 'all';
export interface SoothPricePoint {
  /** Unix seconds. */
  time: number;
  /** YES probability, 0..1. */
  yes: number;
}
export interface SoothPriceHistory {
  points: SoothPricePoint[];
  source: 'indexer' | 'unavailable';
  reason?: string;
}

const WINDOWS = {
  '5m': { span: 300, width: 5 },
  '1h': { span: 3_600, width: 60 },
  '1d': { span: 86_400, width: 900 },
} as const;
const ALL_WIDTHS = [60, 300, 900, 3_600, 14_400, 86_400, 604_800];
const MAX_POINTS = 240;

interface PriceObservation {
  time: number;
  yes: number;
  blockNumber: number;
  logIndex: number;
}

/**
 * Last price per bucket, ascending. A window opens on the last price before it and the
 * series ends at the indexed head, so a quiet market draws a flat line instead of nothing.
 */
function bucketPrices(
  observations: PriceObservation[],
  range: SoothChartInterval,
  head: number,
): SoothPricePoint[] {
  const sorted = [...observations].sort(
    (a, b) => a.time - b.time || a.blockNumber - b.blockNumber || a.logIndex - b.logIndex,
  );
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last) return [];
  const end = Math.max(head, last.time);
  let width: number;
  let start: number;
  if (range === 'all') {
    const span = end - first.time;
    width = ALL_WIDTHS.find((value) => span / value <= MAX_POINTS) ?? Math.ceil(span / MAX_POINTS);
    start = Math.floor(first.time / width) * width;
  } else {
    width = WINDOWS[range].width;
    start = Math.floor((end - WINDOWS[range].span) / width) * width;
  }
  let opening: number | undefined;
  const buckets = new Map<number, number>();
  for (const observation of sorted) {
    if (observation.time < start) opening = observation.yes;
    else buckets.set(Math.floor(observation.time / width) * width, observation.yes);
  }
  const points = [...buckets].map(([time, yes]) => ({ time, yes }));
  if (opening !== undefined && points[0]?.time !== start)
    points.unshift({ time: start, yes: opening });
  const close = points[points.length - 1]!;
  if (close.time < end) points.push({ time: end, yes: close.yes });
  return points;
}

/** AMM: marginal YES price per state change. Book: YES-axis fill price. */
export async function readSoothPriceHistory(
  resolved: SoothResolvedMarket,
  range: SoothChartInterval,
): Promise<SoothPriceHistory> {
  if (!resolved.indexer)
    return {
      points: [],
      source: 'unavailable',
      reason: 'Price history needs an indexer, and this application has none configured.',
    };
  const input = {
    identity: resolved.reference,
    market: resolved.reference.market,
    options: resolved.indexer,
  };
  let head: number;
  let observations: PriceObservation[];
  try {
    if (resolved.reference.venue === 'amm') {
      const page = await fetchFactoryPrices(input);
      head = page.indexed.timestamp;
      observations = page.items.flatMap((point) =>
        point.timestamp === null
          ? []
          : [
              {
                time: point.timestamp,
                yes: probability(point.price),
                blockNumber: point.blockNumber,
                logIndex: point.logIndex,
              },
            ],
      );
    } else {
      const page = await fetchFactoryFills(input);
      head = page.indexed.timestamp;
      observations = page.items.flatMap((fill) =>
        fill.timestamp === null
          ? []
          : [
              {
                time: fill.timestamp,
                yes: fill.yesTick / 1000,
                blockNumber: fill.blockNumber,
                logIndex: fill.logIndex,
              },
            ],
      );
    }
  } catch (error) {
    return { points: [], source: 'unavailable', reason: describeSoothError(error) };
  }
  return { points: bucketPrices(observations, range, head), source: 'indexer' };
}

export interface SoothDepthLevel {
  /** YES price, 0..1. */
  price: number;
  tick: number;
  /** WAD. */
  shares: bigint;
}
export interface SoothDepth {
  /** Highest price first. */
  bids: SoothDepthLevel[];
  /** Lowest price first. */
  asks: SoothDepthLevel[];
  complete: boolean;
  source: 'indexer' | 'rpc';
  blockNumber?: bigint;
}

function depthFrom(
  levels: readonly FactoryBookLevel[],
  complete: boolean,
  source: SoothDepth['source'],
  blockNumber: bigint,
): SoothDepth {
  const bids: SoothDepthLevel[] = [];
  const asks: SoothDepthLevel[] = [];
  for (const level of levels)
    if (level.amountWad > 0n)
      (level.side === 0 ? bids : asks).push({
        price: level.yesTick / 1000,
        tick: level.yesTick,
        shares: level.amountWad,
      });
  bids.sort((a, b) => b.tick - a.tick);
  asks.sort((a, b) => a.tick - b.tick);
  return { bids, asks, complete, source, blockNumber };
}

/** Indexed depth first; the trusted RPC answers when no indexer is configured or it fails. */
export async function readSoothDepth(resolved: SoothResolvedMarket): Promise<SoothDepth> {
  const { market } = resolved.reference;
  if (resolved.indexer) {
    try {
      const indexed = await fetchFactoryIndexedDepth({
        identity: resolved.reference,
        market,
        options: resolved.indexer,
      });
      return depthFrom(indexed.levels, indexed.complete, 'indexer', indexed.blockNumber);
    } catch {
      // An unavailable or malformed indexer falls back to chain reads.
    }
  }
  const book = await readFactoryBookDepth({
    context: resolved.context,
    client: factoryReadClient(resolved.client),
    market,
  });
  return depthFrom(book.levels, book.complete, 'rpc', book.blockNumber);
}

export interface SoothLiveQuote {
  side: 'buy' | 'sell';
  outcome: 0 | 1;
  /** WAD. */
  shares: bigint;
  /** Cost for a buy, proceeds for a sell, fee included. */
  amountNative: bigint;
  feeNative: bigint;
  /** Traded outcome price per share before fees, 0..1. */
  averagePrice: number;
  /** YES probability. */
  priceBefore: number;
  /** YES probability. */
  priceAfter: number;
  /** Movement of the traded outcome's price as a signed fraction of one. */
  priceImpact: number;
  blockNumber: bigint;
}

/** Display-only: no account, approvals or bounds. Signing always re-plans with planSoothTrade. */
export async function quoteSoothTrade(
  resolved: SoothResolvedMarket,
  intent: SoothTradeIntent,
): Promise<SoothLiveQuote> {
  if (intent.side !== 'buy' && intent.side !== 'sell') throw new Error('Invalid trade side.');
  if (intent.outcome !== 0 && intent.outcome !== 1) throw new Error('Invalid outcome.');
  const shares = sharesAmount(intent.shares);
  const { side, outcome } = intent;
  const buy = side === 'buy';
  const { market } = resolved.reference;
  const { context } = resolved;
  if (resolved.reference.venue === 'book' && centsToTick(intent.price) === null)
    throw new Error('Enter a price in cents between 0.1 and 99.9.');
  const client = factoryReadClient(resolved.client);
  const { blockNumber, read, abis } = await factoryMarketScope({ context, client, market });
  if (resolved.reference.venue === 'amm') {
    const [[, , priceWad], decimals, quote] = await Promise.all([
      read<readonly [bigint, bigint, bigint]>(
        context.contracts.amm,
        abis.AMMEngineAbi,
        'getMarketState',
        [market],
      ),
      read<number>(context.contracts.amm, abis.AMMEngineAbi, 'tokenADecimalsOf', [market]),
      readFactoryQuote({
        context,
        client,
        market,
        blockNumber,
        outcome,
        deltaShares: buy ? shares : -shares,
      }),
    ]);
    const priceBefore = probability(priceWad);
    const priceAfter = probability(quote.newPriceWad);
    return {
      side,
      outcome,
      shares,
      amountNative: buy
        ? wadToNativeCeil(quote.netWad, decimals)
        : wadToNativeFloor(quote.netWad, decimals),
      feeNative: wadToNativeCeil(quote.feeWad, decimals),
      averagePrice: Number(quote.costWad) / Number(shares),
      priceBefore,
      priceAfter,
      priceImpact: outcome === 1 ? priceAfter - priceBefore : priceBefore - priceAfter,
      blockNumber,
    };
  }
  const tick = centsToTick(intent.price)!;
  const [shareUnit, decimals, feeBps] = await Promise.all([
    read<bigint>(context.contracts.book, abis.OrderEngineAbi, 'shareUnit'),
    read<number>(context.contracts.book, abis.OrderEngineAbi, 'baseTokenDecimals'),
    read<number>(context.contracts.bookVault, abis.BookFeeVaultAbi, 'feeBpsOf', [market]),
  ]);
  if (shareUnit <= 0n || shares % shareUnit !== 0n)
    throw new Error(`The order book takes shares in steps of ${formatUnits(shareUnit, 18)}.`);
  // The taker fee is charged on min(p, 1 - p) per share at the execution price.
  const basisWad = (shares * BigInt(Math.min(tick, 1_000 - tick))) / 1_000n;
  const { feeNative } = allocateBookFee(basisWad, Number(feeBps), 0, decimals);
  const valueNative = buy
    ? bookBuyCashNative(tick, shares, shareUnit)
    : ((shares / shareUnit) * BigInt(tick)) / 1_000n;
  const yes = yesAxisTick(outcome, tick) / 1_000;
  return {
    side,
    outcome,
    shares,
    amountNative: buy
      ? valueNative + feeNative
      : valueNative > feeNative
        ? valueNative - feeNative
        : 0n,
    feeNative,
    averagePrice: tick / 1_000,
    priceBefore: yes,
    priceAfter: yes,
    priceImpact: 0,
    blockNumber,
  };
}

/** Floor is WAD; fee, refund and deferred balances are native units. */
export interface SoothLpEntitlements {
  blockNumber: bigint;
  tokenA: Address;
  bookToken: Address;
  floorWad: bigint;
  lpDividendNative: bigint;
  checkpointedLpFeesNative: bigint;
  bookTimeoutRefundNative: bigint;
  bookDeferredNative: bigint;
  /** Total LP fees across receipts after settlement; null when it cannot be simulated. */
  simulatedLpFeesNative: bigint | null;
  lpFeesComplete: boolean;
  lpFeesGap: string | null;
}
export interface SoothLiquidityReceipt extends FactoryLpPosition {
  /** This receipt's simulated fee claim, native units; null before settlement or when it cannot be simulated. */
  feesNative: bigint | null;
  feesGap: string | null;
  /** Redeem, floor and fees in one call. Settled markets only. */
  claimAvailable: { kind: 'claimAvailable'; positionId: bigint; units: bigint } | null;
  redeem: { kind: 'redeemLPPosition'; positionId: bigint; units: bigint } | null;
  claimFees: Extract<FactoryTransactionAction, { kind: 'claimLPDividendForPosition' }> | null;
}
export interface SoothLiquidityClaim {
  action: { kind: 'claimFloor' | 'claimLPDividend' };
  amountNative: bigint;
}
export interface SoothLiquidity {
  blockNumber: bigint;
  /** AMM collateral. */
  token: SoothMarketData['token'];
  liquidityOpen: boolean;
  settled: boolean;
  receipts: SoothLiquidityReceipt[];
  entitlements: SoothLpEntitlements;
  /** Nonzero market-level LP claims. */
  claims: SoothLiquidityClaim[];
}

export async function readSoothLiquidity(
  resolved: SoothResolvedMarket,
  account: Address,
): Promise<SoothLiquidity> {
  // LP receipts follow the AMM, whatever venue the widget trades on.
  const { snapshot, token } = await readSoothMarket({
    ...resolved,
    reference: { ...resolved.reference, venue: 'amm' },
  });
  const { context } = resolved;
  const { market } = resolved.reference;
  const { blockNumber, settled } = snapshot;
  const client = factoryEventClient(resolved.client);
  const input = { context, client, market, account, blockNumber };
  const [lp, entitlements] = await Promise.all([
    discoverFactoryLpPositions(input),
    readFactoryEntitlements(input),
  ]);
  const { AmmFeeVaultAbi } = getFactoryAbis(context.release);
  const receipts: SoothLiquidityReceipt[] = [];
  for (const position of lp.positions) {
    const { positionId, units } = position;
    let feesNative: bigint | null = null;
    let feesGap: string | null = settled ? null : 'LP fees can be claimed after settlement.';
    if (settled) {
      try {
        if (!client.simulateContract) throw new Error('LP fee simulation is unavailable.');
        const { result } = await client.simulateContract({
          address: context.contracts.ammVault,
          abi: AmmFeeVaultAbi,
          functionName: 'claimLPDividendForPosition',
          args: [market, positionId],
          account,
          blockNumber,
        });
        if (typeof result !== 'bigint' || result < 0n) throw new Error('Malformed LP fee result.');
        feesNative = result;
      } catch (error) {
        feesGap = describeSoothError(error);
      }
    }
    receipts.push({
      ...position,
      feesNative,
      feesGap,
      claimAvailable: settled ? { kind: 'claimAvailable', positionId, units } : null,
      redeem: settled ? { kind: 'redeemLPPosition', positionId, units } : null,
      claimFees:
        feesNative !== null && feesNative > 0n
          ? { kind: 'claimLPDividendForPosition', positionId }
          : null,
    });
  }
  const claims: SoothLiquidityClaim[] = [];
  if (entitlements.floorWad > 0n)
    claims.push({
      action: { kind: 'claimFloor' },
      amountNative: wadToNativeFloor(entitlements.floorWad, token.decimals),
    });
  if (settled && entitlements.lpDividendNative > 0n)
    claims.push({
      action: { kind: 'claimLPDividend' },
      amountNative: entitlements.lpDividendNative,
    });
  return {
    blockNumber,
    token,
    liquidityOpen: snapshot.liquidityOpen,
    settled,
    receipts,
    entitlements,
    claims,
  };
}

export interface SoothLiquidityPreview extends SoothTradePreview {
  action: Extract<FactoryTransactionAction, { kind: 'increaseLiquidity' }>;
  /** LP approvals target the AMM, whatever venue the widget trades on. */
  approvalVenue: 'amm';
  /** Exact collateral the quoted state takes, native units. */
  quotedNative: bigint;
  receiptUnits: bigint;
}

/**
 * Largest depth whose quote fits the budget. The quote is linear in depth plus a fixed
 * weight buffer, so two probes fit it; bounded shrinking absorbs rounding.
 */
async function depthForBudget(
  quote: (additionalB: bigint) => Promise<bigint>,
  budget: bigint,
): Promise<bigint> {
  const small = WAD;
  const smallCost = await quote(small);
  if (smallCost <= 0n) throw new Error('The liquidity quote is unavailable.');
  let large = (budget * small) / smallCost;
  if (large <= small) large = small * 2n;
  const largeCost = await quote(large);
  if (largeCost <= smallCost) throw new Error('The liquidity quote is unavailable.');
  let depth = small + ((budget - smallCost) * (large - small)) / (largeCost - smallCost);
  for (let attempt = 0; attempt < 4 && depth > 0n; attempt++) {
    const cost = await quote(depth);
    if (cost <= budget) return depth;
    depth = (depth * budget) / cost - 1n;
  }
  throw new Error('This amount is below the smallest liquidity addition.');
}

/** Mirrors planSoothTrade: fresh binding and reads, exact approval, and limits bound to the quoted state. */
export async function planSoothAddLiquidity(
  resolved: SoothResolvedMarket,
  account: Address,
  amountNative: bigint,
): Promise<SoothLiquidityPreview> {
  if (typeof amountNative !== 'bigint' || amountNative <= 0n)
    throw new Error('Enter an amount above zero.');
  const context = await assertMarketBinding({
    identity: resolved.reference,
    release: resolved.context.release,
    endpoints: resolved.endpoints,
    catalog: resolved.context.contracts,
    market: resolved.reference.market,
  });
  const current: SoothResolvedMarket = {
    ...resolved,
    reference: { ...resolved.reference, venue: 'amm' },
    context,
  };
  const data = await readSoothMarket(current, account);
  const { snapshot } = data;
  if (!snapshot.liquidityOpen) throw new Error('Liquidity additions are closed for this market.');
  if (!data.account || data.account.address.toLowerCase() !== account.toLowerCase())
    throw new Error('Wallet balances are unavailable for this account.');
  await checkNewExposure(current, data);
  const now = snapshot.blockTimestamp;
  if (now === null || snapshot.deadline <= now)
    throw new Error('A current chain timestamp before the market deadline is required.');
  const deadline = now + 300n < snapshot.deadline ? now + 300n : snapshot.deadline;
  const { market } = resolved.reference;
  const scope = await factoryMarketScope({
    context,
    client: factoryReadClient(resolved.client),
    market,
    blockNumber: snapshot.blockNumber,
  });
  const additionalB = await depthForBudget(
    async (depth) =>
      (
        await scope.read<readonly [bigint, bigint, bigint]>(
          context.contracts.amm,
          scope.abis.AMMEngineAbi,
          'quoteLiquidity',
          [market, depth],
        )
      )[0],
    amountNative,
  );
  const quote = await readFactoryLiquidityQuote({
    context,
    endpoints: resolved.endpoints,
    market,
    additionalB,
    deadline,
    slippageBps: 100,
  });
  if (quote.tokenIn > amountNative)
    throw new Error('The liquidity quote moved above this amount. Review again.');
  // The state hash fixes the quoted state; the budget stays the spending ceiling.
  const limits = {
    ...quote.limits,
    maxTokenIn: quote.limits.maxTokenIn < amountNative ? quote.limits.maxTokenIn : amountNative,
  };
  const wallet = data.account;
  const shortfall = tokenShortfall(wallet.balance, limits.maxTokenIn, data.token, 'This deposit');
  if (shortfall) throw new Error(shortfall);
  const approval = planTokenApproval({
    allowance: wallet.allowance,
    requiredNative: limits.maxTokenIn,
  });
  if (!approval.ok) throw new Error(approval.reason);
  return {
    action: { kind: 'increaseLiquidity', additionalB, limits },
    approveNative: approval.approveNative,
    approvalVenue: 'amm',
    allowance: wallet.allowance,
    requiredNative: limits.maxTokenIn,
    quotedNative: quote.tokenIn,
    receiptUnits: quote.receiptUnits,
    feeBps: 0,
    data,
    description: `Add ${formatTokenRounded(quote.tokenIn, data.token, 'up')} of AMM liquidity at the current price. The deposit is bound to the quoted pool state and expires after five minutes.`,
  };
}

export interface SoothMarketSummary {
  /** AMM YES probability; null when the pool has no price. */
  yes: number | null;
  tradingOpen: boolean;
  deadline: bigint;
  /** AMM collateral, native units; null when unreadable. */
  liquidityNative: bigint | null;
  tokenDecimals: number;
  tokenSymbol: string;
}

const NODE_CONCURRENCY = 4;

/** Token symbols read once per call; an unreadable symbol shows the short address. */
function symbolReader(client: FactoryReadClient, blockNumber: bigint) {
  const symbols = new Map<string, Promise<string>>();
  return (token: Address) => {
    let pending = symbols.get(token.toLowerCase());
    if (!pending) {
      pending = client
        .readContract({ address: token, abi: erc20Abi, functionName: 'symbol', blockNumber })
        .then(
          (value) => String(value),
          () => `${token.slice(0, 6)}…${token.slice(-4)}`,
        );
      symbols.set(token.toLowerCase(), pending);
    }
    return pending;
  };
}

async function summarizeMarket(
  context: FactoryNodeContext,
  client: FactoryReadClient,
  market: Address,
  blockNumber: bigint,
  symbol: (token: Address) => Promise<string>,
): Promise<SoothMarketSummary> {
  const snapshot = await readFactoryMarketSnapshot({ context, client, market, blockNumber });
  const [tokenSymbol, collateralWad] = await Promise.all([
    symbol(snapshot.tokenA),
    client
      .readContract({
        address: context.contracts.amm,
        abi: getFactoryAbis(context.release).AMMEngineAbi,
        functionName: 'getMarketCollateral',
        args: [market],
        blockNumber,
      })
      .then(
        (value) => (typeof value === 'bigint' ? value : null),
        () => null,
      ),
  ]);
  return {
    yes:
      snapshot.yesPriceWad > 0n && snapshot.yesPriceWad < WAD
        ? probability(snapshot.yesPriceWad)
        : null,
    tradingOpen: snapshot.tradingOpen,
    deadline: snapshot.deadline,
    liquidityNative:
      collateralWad === null ? null : wadToNativeFloor(collateralWad, snapshot.tokenADecimals),
    tokenDecimals: snapshot.tokenADecimals,
    tokenSymbol,
  };
}

/** One market's card figures, read no earlier than this widget's last confirmed receipt. */
export async function readSoothMarketSummary(
  resolved: SoothResolvedMarket,
): Promise<SoothMarketSummary> {
  const client = factoryReadClient(resolved.client);
  const head = await client.getBlockNumber();
  const receiptFloor = freshReceiptBlock(resolved.context);
  const blockNumber = receiptFloor !== undefined && receiptFloor > head ? receiptFloor : head;
  return summarizeMarket(
    resolved.context,
    client,
    resolved.reference.market,
    blockNumber,
    symbolReader(client, blockNumber),
  );
}

/** One block for every card. An unreadable market is left out rather than failing the list. */
export async function readSoothNodeMarkets(
  node: SoothResolvedNode,
  markets: readonly Address[],
): Promise<Map<Address, SoothMarketSummary>> {
  const summaries = new Map<Address, SoothMarketSummary>();
  if (markets.length === 0) return summaries;
  const { context } = node;
  const client = factoryReadClient(node.client);
  const blockNumber = await client.getBlockNumber();
  const symbol = symbolReader(client, blockNumber);
  const results = new Map<Address, SoothMarketSummary>();
  let next = 0;
  const worker = async () => {
    while (next < markets.length) {
      const market = markets[next++]!;
      try {
        results.set(market, await summarizeMarket(context, client, market, blockNumber, symbol));
      } catch {
        // One unreadable market must not hide the others.
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(NODE_CONCURRENCY, markets.length) }, () => worker()),
  );
  for (const market of markets) {
    const summary = results.get(market);
    if (summary) summaries.set(market, summary);
  }
  return summaries;
}
