import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Address, Hex, PublicClient } from 'viem';
import {
  assertMarketBinding, factoryMarketKey, factoryMarketScope, readFactoryMarketSnapshot, readFactoryQuote,
  type FactoryMarketSnapshot, type FactoryNodeContext,
} from '../../src/factory/factoryClient.js';
import { fetchFactoryFills, fetchFactoryIndexedDepth, fetchFactoryPrices } from '../../src/factory/factoryIndexer.js';
import { discoverFactoryLpPositions, readFactoryBookDepth, readFactoryEntitlements, type FactoryLpPosition } from '../../src/factory/factoryPortfolio.js';
import { readFactoryLiquidityQuote } from '../../src/factory/factoryLifecycle.js';
import { deriveNodeChildren } from '../../src/factory/factoryTrade/nodeChildren.js';
import { SUPPORTED_FACTORY_RELEASES } from '../../src/factory/releases.js';
import { forgetReceipt, noteReceipt } from '../../src/factory/factoryTrade/afterReceipt.js';
import type { FactoryCatalogSnapshot } from '../../src/factory/factoryCatalog.js';
import type { FactoryCatalogMarket } from '../../src/factory/schema.js';
import { readSoothMarket, type SoothMarketData, type SoothResolvedMarket, type SoothResolvedNode } from '../../src/react/runtime.js';
import {
  planSoothAddLiquidity, quoteSoothTrade, readSoothDepth, readSoothLiquidity, readSoothMarketSummary, readSoothNodeMarkets, readSoothPriceHistory,
} from '../../src/react/data.js';
import type * as FactoryClientModule from '../../src/factory/factoryClient.js';
import type * as FactoryIndexerModule from '../../src/factory/factoryIndexer.js';
import type * as FactoryPortfolioModule from '../../src/factory/factoryPortfolio.js';
import type * as FactoryLifecycleModule from '../../src/factory/factoryLifecycle.js';

vi.mock('../../src/react/runtime.js', () => ({ readSoothMarket: vi.fn() }));
vi.mock('../../src/factory/factoryClient.js', async importOriginal => ({
  ...await importOriginal<typeof FactoryClientModule>(),
  assertMarketBinding: vi.fn(), factoryMarketScope: vi.fn(), readFactoryMarketSnapshot: vi.fn(), readFactoryQuote: vi.fn(),
}));
vi.mock('../../src/factory/factoryIndexer.js', async importOriginal => ({
  ...await importOriginal<typeof FactoryIndexerModule>(),
  fetchFactoryPrices: vi.fn(), fetchFactoryFills: vi.fn(), fetchFactoryIndexedDepth: vi.fn(),
}));
vi.mock('../../src/factory/factoryPortfolio.js', async importOriginal => ({
  ...await importOriginal<typeof FactoryPortfolioModule>(),
  readFactoryBookDepth: vi.fn(), discoverFactoryLpPositions: vi.fn(), readFactoryEntitlements: vi.fn(),
}));
vi.mock('../../src/factory/factoryLifecycle.js', async importOriginal => ({
  ...await importOriginal<typeof FactoryLifecycleModule>(),
  readFactoryLiquidityQuote: vi.fn(),
}));

const address = (n: number) => `0x${n.toString(16).padStart(40, '0')}` as Address;
const hash = (n: number) => `0x${n.toString(16).padStart(64, '0')}` as Hex;
const WAD = 10n ** 18n;
const market = address(3), account = address(4), token = address(5);
const release = SUPPORTED_FACTORY_RELEASES[1];
const context: FactoryNodeContext = {
  chainId: release.chainId, factory: release.factory, nodeId: hash(1),
  release: { chainId: release.chainId, factory: release.factory, releaseId: release.releaseId, interfaceVersion: release.interfaceVersion, startBlock: 1 },
  contracts: { ...deriveNodeChildren(address(2)), deployer: address(2) }, startBlock: 1n, blockNumber: 10n,
};
const indexed = { blockNumber: 10, blockHash: hash(10), timestamp: 10_000 };
function catalog(): FactoryCatalogSnapshot<FactoryCatalogMarket> {
  const at = { blockNumber: 10, blockHash: hash(10), timestamp: 1_000 };
  return {
    items: [{ key: factoryMarketKey(context, market), address: market, identity: context, indexed: at, listing: { state: 'listed' } } as FactoryCatalogMarket],
    next: null, catalogRevision: '1', receivedAt: Date.now(), indexed: at,
    facts: { source: 'live', ageSeconds: 0 }, overrides: { source: 'live', ageSeconds: 0, revision: '1' },
  };
}
const snapshot = (patch: Partial<FactoryMarketSnapshot> = {}) => ({
  market, blockNumber: 10n, blockTimestamp: 1_000n, startTime: 1n, invalidationBuffer: 100n,
  permissionlessInvalidationAt: 10_100n, adjudicator: address(6), phase: 0, isAttested: false,
  isResolving: false, settlementKind: 0, qYes: 0n, qNo: 0n, yesPriceWad: WAD / 2n,
  tokenA: token, tokenADecimals: 6, bookToken: token, bookTokenDecimals: 6,
  shareUnit: 10n ** 12n, ammFeeBps: 100, bookFeeBps: 100, tradingOpen: true,
  liquidityOpen: true, settled: false, outcome: null, deadline: 10_000n, ...patch,
}) as FactoryMarketSnapshot;
function marketData(): SoothMarketData {
  return {
    snapshot: snapshot(), token: { address: token, decimals: 6, symbol: 'TEST' },
    account: {
      address: account, balance: 1_000_000_000n, allowance: 0n,
      entitlements: { blockNumber: 10n, floorWad: 0n, bookTimeoutRefundNative: null, bookDeferredNative: null },
    },
  };
}
let resolved: SoothResolvedMarket;
let reads: Record<string, unknown>;
async function read(_address: Address, _abi: unknown, name: string, args: readonly unknown[] = []) {
  const value = reads[name];
  if (value === undefined) throw new Error(`Unexpected read ${name}`);
  return typeof value === 'function' ? (value as (...a: readonly unknown[]) => unknown)(...args) : value;
}
beforeEach(() => {
  vi.resetAllMocks();
  const page = catalog();
  resolved = {
    reference: { ...context, releaseId: context.release.releaseId, market, venue: 'amm' },
    context, client: { simulateContract: vi.fn() } as unknown as PublicClient, endpoints: [], catalog: page,
    record: page.items[0]!, question: 'Question', rules: 'Rules', canonicalUrl: 'https://example.test/v1/market',
    refreshCatalog: vi.fn().mockResolvedValue(page), indexer: { baseUrl: 'https://indexer.test/' },
  };
  reads = {};
  vi.mocked(factoryMarketScope, { partial: true }).mockResolvedValue({ blockNumber: 42n, read, abis: {} as never });
});

const pricePoint = (timestamp: number | null, price: number, blockNumber: number, logIndex = 0) => ({
  market, price: BigInt(Math.round(price * 1000)) * 10n ** 15n, qYes: 0n, qNo: 0n,
  blockNumber, logIndex, blockHash: hash(blockNumber), timestamp,
});
describe('price history', () => {
  it('reports an unavailable indexer without reading', async () => {
    resolved.indexer = null;
    await expect(readSoothPriceHistory(resolved, '1h')).resolves.toMatchObject({ points: [], source: 'unavailable', reason: expect.stringContaining('indexer') });
    expect(fetchFactoryPrices).not.toHaveBeenCalled();
  });
  it('turns an indexer HTTP failure into an unavailable chart instead of an error', async () => {
    vi.mocked(fetchFactoryPrices).mockRejectedValue(new Error('Factory indexer HTTP 503'));
    await expect(readSoothPriceHistory(resolved, '1h')).resolves.toEqual({ points: [], source: 'unavailable', reason: 'Factory indexer HTTP 503' });
  });
  it('sorts, keeps the last price per bucket, opens on the prior price and ends at the indexed head', async () => {
    vi.mocked(fetchFactoryPrices).mockResolvedValue({ indexed, next: null, complete: true, items: [
      pricePoint(9_000, 0.8, 9, 2), pricePoint(6_530, 0.45, 7), pricePoint(5_000, 0.3, 5),
      pricePoint(9_000, 0.7, 9, 1), pricePoint(null, 0.9, 8), pricePoint(6_500, 0.4, 6),
    ] });
    const history = await readSoothPriceHistory(resolved, '1h');
    expect(history.source).toBe('indexer');
    // Window start aligns to the minute bucket at or before head - 1h.
    expect(history.points).toEqual([
      { time: 6_360, yes: 0.3 }, { time: 6_480, yes: 0.45 }, { time: 9_000, yes: 0.8 }, { time: 10_000, yes: 0.8 },
    ]);
  });
  it('charts book fills on the YES axis and keeps an empty market empty', async () => {
    resolved.reference.venue = 'book';
    const fill = (timestamp: number, yesTick: number, blockNumber: number) => ({
      market, maker: account, taker: address(7), orderId: 1n, amount: WAD, remaining: 0n, cashReserved: 0n,
      yesTick, settlementType: 0, blockNumber, logIndex: 0, blockHash: hash(blockNumber), transactionHash: hash(99), timestamp,
    });
    vi.mocked(fetchFactoryFills).mockResolvedValue({ indexed, next: null, complete: true, items: [fill(9_990, 620, 2), fill(9_800, 600, 1)] });
    expect((await readSoothPriceHistory(resolved, '5m')).points).toEqual([
      { time: 9_800, yes: 0.6 }, { time: 9_990, yes: 0.62 }, { time: 10_000, yes: 0.62 },
    ]);
    expect(fetchFactoryPrices).not.toHaveBeenCalled();
    vi.mocked(fetchFactoryFills).mockResolvedValue({ indexed, next: null, complete: true, items: [] });
    await expect(readSoothPriceHistory(resolved, '5m')).resolves.toEqual({ points: [], source: 'indexer' });
  });
  it('widens buckets for the full history so the series stays bounded', async () => {
    vi.mocked(fetchFactoryPrices).mockResolvedValue({ indexed: { ...indexed, timestamp: 100_000 }, next: null, complete: true,
      items: Array.from({ length: 1_000 }, (_, i) => pricePoint(i * 100, 0.5, i)) });
    const { points } = await readSoothPriceHistory(resolved, 'all');
    expect(points.length).toBeLessThanOrEqual(240);
    expect(points.slice(0, 2).map(point => point.time)).toEqual([0, 900]);
    expect(points[points.length - 1]!.time).toBe(100_000);
  });
});

describe('book depth', () => {
  const level = (side: 0 | 1, yesTick: number, amountWad: bigint) => ({ side, yesTick, amountWad, orderCount: 1n });
  it('orders bids high to low and asks low to high from the indexer', async () => {
    vi.mocked(fetchFactoryIndexedDepth).mockResolvedValue({ indexed, blockNumber: 10n, fromTick: 1, toTick: 999, complete: true,
      levels: [level(0, 400, WAD), level(1, 700, WAD), level(0, 450, 2n * WAD), level(1, 650, WAD), level(0, 300, 0n)] });
    const depth = await readSoothDepth(resolved);
    expect(depth).toMatchObject({ source: 'indexer', complete: true, blockNumber: 10n });
    expect(depth.bids).toEqual([{ price: 0.45, tick: 450, shares: 2n * WAD }, { price: 0.4, tick: 400, shares: WAD }]);
    expect(depth.asks.map(row => row.tick)).toEqual([650, 700]);
    expect(readFactoryBookDepth).not.toHaveBeenCalled();
  });
  it('falls back to RPC depth when the indexer fails and keeps partial completeness', async () => {
    vi.mocked(fetchFactoryIndexedDepth).mockRejectedValue(new Error('Factory indexer HTTP 500'));
    vi.mocked(readFactoryBookDepth).mockResolvedValue({ blockNumber: 12n, fromTick: 1, toTick: 500, complete: false,
      levels: [level(1, 520, WAD), level(1, 510, WAD)] });
    const depth = await readSoothDepth(resolved);
    expect(depth).toMatchObject({ source: 'rpc', complete: false, blockNumber: 12n, bids: [] });
    expect(depth.asks.map(row => row.tick)).toEqual([510, 520]);
    expect(readFactoryBookDepth).toHaveBeenCalledWith(expect.objectContaining({ market, context }));
  });
  it('reads RPC depth directly without an indexer', async () => {
    resolved.indexer = null;
    vi.mocked(readFactoryBookDepth).mockResolvedValue({ blockNumber: 12n, fromTick: 1, toTick: 999, complete: true, levels: [] });
    await expect(readSoothDepth(resolved)).resolves.toMatchObject({ source: 'rpc', complete: true });
    expect(fetchFactoryIndexedDepth).not.toHaveBeenCalled();
  });
});

describe('live quotes', () => {
  it('prices an AMM buy with fee, average price and impact at one block', async () => {
    reads = { getMarketState: [0n, 0n, WAD / 2n], tokenADecimalsOf: 6 };
    vi.mocked(readFactoryQuote).mockResolvedValue({ costWad: 11n * WAD / 10n, feeWad: 11n * WAD / 1_000n, netWad: 1_111n * WAD / 1_000n, newPriceWad: 6n * WAD / 10n, blockNumber: 42n });
    const quote = await quoteSoothTrade(resolved, { side: 'buy', outcome: 1, shares: '2', price: '' });
    expect(quote).toMatchObject({ side: 'buy', outcome: 1, shares: 2n * WAD, amountNative: 1_111_000n, feeNative: 11_000n, averagePrice: 0.55, priceBefore: 0.5, priceAfter: 0.6, blockNumber: 42n });
    expect(quote.priceImpact).toBeCloseTo(0.1);
    expect(readFactoryQuote).toHaveBeenCalledWith(expect.objectContaining({ blockNumber: 42n, outcome: 1, deltaShares: 2n * WAD }));
  });
  it('rounds AMM sale proceeds down and reports impact on the traded outcome', async () => {
    reads = { getMarketState: [0n, 0n, WAD / 2n], tokenADecimalsOf: 6 };
    vi.mocked(readFactoryQuote).mockResolvedValue({ costWad: WAD, feeWad: WAD / 100n, netWad: 99n * WAD / 100n - 1n, newPriceWad: 55n * WAD / 100n, blockNumber: 42n });
    const quote = await quoteSoothTrade(resolved, { side: 'sell', outcome: 0, shares: '2', price: '' });
    expect(quote.amountNative).toBe(989_999n);
    expect(quote.priceImpact).toBeCloseTo(-0.05);
    expect(readFactoryQuote).toHaveBeenCalledWith(expect.objectContaining({ deltaShares: -2n * WAD }));
  });
  it('prices book limits from the tick and the fee on min(p, 1 - p)', async () => {
    resolved.reference.venue = 'book';
    reads = { shareUnit: 10n ** 12n, baseTokenDecimals: 6, feeBpsOf: 100 };
    const buy = await quoteSoothTrade(resolved, { side: 'buy', outcome: 1, shares: '10', price: '40' });
    expect(buy).toMatchObject({ amountNative: 4_040_000n, feeNative: 40_000n, averagePrice: 0.4, priceBefore: 0.4, priceAfter: 0.4, priceImpact: 0 });
    const sell = await quoteSoothTrade(resolved, { side: 'sell', outcome: 0, shares: '10', price: '70' });
    expect(sell).toMatchObject({ amountNative: 6_970_000n, feeNative: 30_000n, averagePrice: 0.7, priceBefore: 0.3 });
    await expect(quoteSoothTrade(resolved, { side: 'buy', outcome: 1, shares: '0.0000001', price: '40' })).rejects.toThrow('steps');
    expect(readFactoryQuote).not.toHaveBeenCalled();
  });
  it('rejects invalid input before reading', async () => {
    resolved.reference.venue = 'book';
    await expect(quoteSoothTrade(resolved, { side: 'buy', outcome: 1, shares: '1', price: '100' })).rejects.toThrow('price');
    await expect(quoteSoothTrade(resolved, { side: 'buy', outcome: 1, shares: '0', price: '40' })).rejects.toThrow('above zero');
    expect(factoryMarketScope).not.toHaveBeenCalled();
  });
});

describe('node market summaries', () => {
  it('reads every card at one block with at most four in flight and isolates failures', async () => {
    const markets = Array.from({ length: 7 }, (_, i) => address(100 + i));
    let active = 0, peak = 0;
    vi.mocked(readFactoryMarketSnapshot).mockImplementation(async input => {
      active++; peak = Math.max(peak, active);
      const { promise, resolve } = Promise.withResolvers<void>();
      setTimeout(resolve, 5);
      await promise;
      active--;
      if (input.market === markets[2]) throw new Error('Market belongs to another node');
      return snapshot({ market: input.market, yesPriceWad: 3n * WAD / 10n });
    });
    const readContract = vi.fn(async ({ functionName }: { functionName: string }) => functionName === 'symbol' ? 'USDC' : 5n * WAD);
    const node = { context, client: { getBlockNumber: vi.fn().mockResolvedValue(77n), readContract } } as unknown as SoothResolvedNode;
    const summaries = await readSoothNodeMarkets(node, markets);
    expect(peak).toBe(4);
    expect([...summaries.keys()]).toEqual(markets.filter((_, i) => i !== 2));
    expect(summaries.get(markets[0]!)).toEqual({ yes: 0.3, tradingOpen: true, deadline: 10_000n, liquidityNative: 5_000_000n, tokenDecimals: 6, tokenSymbol: 'USDC' });
    expect(vi.mocked(readFactoryMarketSnapshot).mock.calls.every(([input]) => input.blockNumber === 77n)).toBe(true);
    expect(readContract.mock.calls.filter(([call]) => call.functionName === 'symbol')).toHaveLength(1);
  });
  it('reads one market no earlier than a fresh receipt and leaves unreadable collateral null', async () => {
    vi.mocked(readFactoryMarketSnapshot).mockResolvedValue(snapshot({ yesPriceWad: 0n }));
    const readContract = vi.fn(async ({ functionName }: { functionName: string }) => {
      if (functionName === 'symbol') return 'USDC';
      throw new Error('execution reverted');
    });
    resolved.client = { getBlockNumber: vi.fn().mockResolvedValue(77n), readContract } as unknown as PublicClient;
    noteReceipt(context, 90n);
    try {
      expect(await readSoothMarketSummary(resolved)).toEqual({ yes: null, tradingOpen: true, deadline: 10_000n, liquidityNative: null, tokenDecimals: 6, tokenSymbol: 'USDC' });
      expect(readFactoryMarketSnapshot).toHaveBeenCalledWith(expect.objectContaining({ market, blockNumber: 90n }));
    } finally {
      forgetReceipt(context);
    }
  });
});

describe('liquidity', () => {
  const receipt = (positionId: bigint): FactoryLpPosition => ({
    positionId, market, units: 3n * WAD, totalSupply: 3n * WAD, residualNoWad: 0n, residualYesWad: 0n, residualInvalidWad: 0n,
    initialSupplyWad: null, valueIfNoWad: null, valueIfYesWad: null, valueIfInvalidWad: null, valuationComplete: false, valuationGap: 'gap',
  });
  const entitlements = { blockNumber: 10n, tokenA: token, bookToken: token, floorWad: 2n * WAD, lpDividendNative: 9n,
    checkpointedLpFeesNative: 9n, bookTimeoutRefundNative: 0n, bookDeferredNative: 0n, simulatedLpFeesNative: null, lpFeesComplete: false, lpFeesGap: 'x' };
  beforeEach(() => {
    vi.mocked(discoverFactoryLpPositions).mockResolvedValue({ blockNumber: 10n, positions: [receipt(1n), receipt(2n)], complete: true, scannedPositions: 2n });
    vi.mocked(readFactoryEntitlements).mockResolvedValue(entitlements);
  });
  it('offers receipt claims only after settlement and converts the WAD floor to native units', async () => {
    vi.mocked(readSoothMarket).mockResolvedValue({ ...marketData(), snapshot: snapshot({ settled: true }), account: undefined });
    vi.mocked(resolved.client.simulateContract).mockImplementation((async ({ args }: { args: readonly unknown[] }) => {
      if (args[1] === 2n) throw new Error('Nothing to claim');
      return { result: 7n };
    }) as never);
    resolved.reference.venue = 'book';
    const liquidity = await readSoothLiquidity(resolved, account);
    expect(vi.mocked(readSoothMarket).mock.calls[0]![0].reference.venue).toBe('amm');
    expect(liquidity.receipts[0]).toMatchObject({ feesNative: 7n, feesGap: null,
      claimAvailable: { kind: 'claimAvailable', positionId: 1n, units: 3n * WAD }, claimFees: { kind: 'claimLPDividendForPosition', positionId: 1n } });
    expect(liquidity.receipts[1]).toMatchObject({ feesNative: null, feesGap: 'Nothing to claim', claimFees: null, redeem: { kind: 'redeemLPPosition', positionId: 2n } });
    expect(liquidity.claims).toEqual([
      { action: { kind: 'claimFloor' }, amountNative: 2_000_000n },
      { action: { kind: 'claimLPDividend' }, amountNative: 9n },
    ]);
  });
  it('withholds settlement actions on an open market', async () => {
    vi.mocked(readSoothMarket).mockResolvedValue({ ...marketData(), account: undefined });
    const liquidity = await readSoothLiquidity(resolved, account);
    expect(liquidity.receipts.every(item => !item.claimAvailable && !item.redeem && !item.claimFees)).toBe(true);
    expect(liquidity.claims.map(claim => claim.action.kind)).toEqual(['claimFloor']);
    expect(resolved.client.simulateContract).not.toHaveBeenCalled();
  });
});

describe('add liquidity preview', () => {
  // Linear in depth plus a fixed buffer, like AMMEngine.quoteLiquidity.
  const cost = (depth: bigint) => (depth * 7n) / 10n / 10n ** 12n + 1_000n;
  let data: SoothMarketData;
  beforeEach(() => {
    data = marketData();
    vi.mocked(assertMarketBinding).mockResolvedValue({ ...context, market, adjudicator: address(6) });
    vi.mocked(readSoothMarket).mockResolvedValue(data);
    reads = { quoteLiquidity: (_market: unknown, depth: unknown) => [cost(depth as bigint), 0n, WAD / 2n] };
    vi.mocked(readFactoryLiquidityQuote).mockImplementation(async input => {
      const tokenIn = cost(input.additionalB);
      return { tokenIn, receiptUnits: tokenIn * 10n ** 12n, price: WAD / 2n, stateHash: hash(9), blockNumber: 11n, context,
        limits: { maxTokenIn: (tokenIn * 10_100n + 9_999n) / 10_000n, minLpOut: 1n, minYesPrice: 1n, maxYesPrice: WAD - 1n, deadline: input.deadline, expectedStateHash: hash(9) } };
    });
  });
  it('spends at most the budget with an exact approval bound to the quoted state', async () => {
    const budget = 100_000_000n;
    resolved.reference.venue = 'book';
    const preview = await planSoothAddLiquidity(resolved, account, budget);
    expect(vi.mocked(readSoothMarket).mock.calls[0]![0].reference.venue).toBe('amm');
    expect(preview.action.kind).toBe('increaseLiquidity');
    expect(preview.quotedNative).toBeLessThanOrEqual(budget);
    expect(preview.quotedNative).toBeGreaterThan(budget - 2n);
    expect(preview.action.limits).toMatchObject({ maxTokenIn: budget, deadline: 1_300n, expectedStateHash: hash(9) });
    expect(preview).toMatchObject({ approvalVenue: 'amm', approveNative: budget, requiredNative: budget, allowance: 0n });
    expect(readFactoryLiquidityQuote).toHaveBeenCalledWith(expect.objectContaining({ slippageBps: 100, additionalB: preview.action.additionalB }));
    expect(resolved.refreshCatalog).toHaveBeenCalledOnce();
  });
  it('re-reads allowance on every preview and skips approval once it suffices', async () => {
    data.account!.allowance = 5n;
    expect(await planSoothAddLiquidity(resolved, account, 50_000_000n)).toMatchObject({ allowance: 5n, approveNative: 50_000_000n });
    data.account!.allowance = 50_000_000n;
    expect((await planSoothAddLiquidity(resolved, account, 50_000_000n)).approveNative).toBeNull();
    expect(assertMarketBinding).toHaveBeenCalledTimes(2);
  });
  it('blocks closed liquidity, short balances, stale quotes and late markets', async () => {
    data.account!.balance = 1n;
    await expect(planSoothAddLiquidity(resolved, account, 50_000_000n)).rejects.toThrow('wallet has');
    data.account!.balance = 10n ** 12n;
    vi.mocked(readFactoryLiquidityQuote).mockResolvedValueOnce({ tokenIn: 60_000_000n } as never);
    await expect(planSoothAddLiquidity(resolved, account, 50_000_000n)).rejects.toThrow('moved');
    data.snapshot = snapshot({ deadline: 1_000n });
    await expect(planSoothAddLiquidity(resolved, account, 50_000_000n)).rejects.toThrow('deadline');
    data.snapshot = snapshot({ liquidityOpen: false });
    await expect(planSoothAddLiquidity(resolved, account, 50_000_000n)).rejects.toThrow('closed');
    await expect(planSoothAddLiquidity(resolved, account, 0n)).rejects.toThrow('above zero');
  });
});
