import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { erc20Abi, getAddress, type Address, type Hex, type PublicClient, type TransactionReceipt } from 'viem';
import { assertMarketBinding, readFactoryQuote, type FactoryNodeContext } from '../../src/factory/factoryClient.js';
import { buildFactoryTransaction, type FactoryTransactionAction } from '../../src/factory/factoryTransactions.js';
import { deriveNodeChildren } from '../../src/factory/factoryTrade/nodeChildren.js';
import { factoryMarketKey } from '../../src/factory/factoryClient.js';
import type { FactoryCatalogSnapshot } from '../../src/factory/factoryCatalog.js';
import type { FactoryCatalogMarket } from '../../src/factory/schema.js';
import { readSoothMarket, type SoothMarketData, type SoothResolvedMarket } from '../../src/react/runtime.js';
import { canPersistSoothPending, loadSoothPending, reconcileSoothPending, saveSoothPending, type SoothWalletAdapter } from '../../src/react/wallet.js';
import { planSoothTrade, sendSoothAction, type SoothTradeIntent } from '../../src/react/trading.js';
import type * as FactoryClientModule from '../../src/factory/factoryClient.js';
import type * as FactoryTransactionsModule from '../../src/factory/factoryTransactions.js';
import { formatSoothMarketReference } from '../../src/react/embed.js';

vi.mock('../../src/react/runtime.js', () => ({ readSoothMarket: vi.fn() }));
vi.mock('../../src/react/wallet.js', () => ({ canPersistSoothPending: vi.fn(), loadSoothPending: vi.fn(() => []), reconcileSoothPending: vi.fn(), saveSoothPending: vi.fn() }));
vi.mock('../../src/factory/factoryClient.js', async importOriginal => ({
  ...await importOriginal<typeof FactoryClientModule>(),
  assertMarketBinding: vi.fn(), readFactoryQuote: vi.fn(),
}));
vi.mock('../../src/factory/factoryTransactions.js', async importOriginal => ({
  ...await importOriginal<typeof FactoryTransactionsModule>(),
  buildFactoryTransaction: vi.fn(),
}));

const address = (n: number) => `0x${n.toString(16).padStart(40, '0')}` as Address;
const hash = (n: number) => `0x${n.toString(16).padStart(64, '0')}` as Hex;
const account = address(4), market = address(3), token = address(5), WAD = 10n ** 18n;
const context: FactoryNodeContext = {
  chainId: 46630, factory: address(1), nodeId: hash(1),
  release: { chainId: 46630, factory: address(1), releaseId: hash(2), interfaceVersion: 'sooth-factory-v7.1', startBlock: 1 },
  contracts: { ...deriveNodeChildren(address(2)), deployer: address(2) }, startBlock: 1n, blockNumber: 10n,
};
const indexed = { blockNumber: 10, blockHash: hash(10), timestamp: 1_000 };
function catalog(): FactoryCatalogSnapshot<FactoryCatalogMarket> {
  return {
    items: [{ key: factoryMarketKey(context, market), address: market, identity: context, indexed, listing: { state: 'listed' } } as FactoryCatalogMarket],
    next: null, catalogRevision: '1', receivedAt: Date.now(), indexed,
    facts: { source: 'live', ageSeconds: 0 }, overrides: { source: 'live', ageSeconds: 0, revision: '1' },
  };
}
function marketData(): SoothMarketData {
  return {
    snapshot: {
      market, blockNumber: 10n, blockTimestamp: 1_000n, startTime: 1n, invalidationBuffer: 100n,
      permissionlessInvalidationAt: 10_100n, adjudicator: address(6), phase: 0, isAttested: false,
      isResolving: false, settlementKind: 0, qYes: 0n, qNo: 0n, yesPriceWad: WAD / 2n,
      tokenA: token, tokenADecimals: 6, bookToken: token, bookTokenDecimals: 6,
      shareUnit: 10n ** 12n, ammFeeBps: 100, bookFeeBps: 100, tradingOpen: true,
      liquidityOpen: true, settled: false, outcome: null, deadline: 10_000n,
    },
    token: { address: token, decimals: 6, symbol: 'TEST' },
    account: {
      address: account, balance: 100_000_000n, allowance: 0n,
      positions: { blockNumber: 10n, complete: true, positions: [{ market, account, blockNumber: 10n, yes: 5n * WAD, no: 2n * WAD }] },
      inventory: {
        blockNumber: 10n, account, bookToken: token, bookTokenDecimals: 6, shareUnit: 10n ** 12n,
        yesOwned: 5n * WAD, noOwned: 2n * WAD, yesReserved: WAD, noReserved: 0n,
        cashReserved: 0n, balance: 100_000_000n, allowance: 0n,
      },
      entitlements: {
        blockNumber: 10n, floorWad: 0n, bookTimeoutRefundNative: null, bookDeferredNative: null,
      },
    },
  };
}
const buy: SoothTradeIntent = { side: 'buy', outcome: 1, shares: '2', price: '50' };
let resolved: SoothResolvedMarket;
let data: SoothMarketData;
let wallet: SoothWalletAdapter;
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('navigator', { locks: { request: vi.fn(async (_name: string, _options: { mode: string }, run: (lock: object | null) => Promise<unknown>) => run({})) } });
  vi.mocked(canPersistSoothPending).mockReturnValue(true);
  const page = catalog();
  data = marketData();
  resolved = {
    reference: { ...context, releaseId: context.release.releaseId, market, venue: 'amm' },
    context, client: { simulateContract: vi.fn().mockResolvedValue({ result: true }) } as unknown as PublicClient,
    endpoints: [], catalog: page, record: page.items[0]!, question: 'Question', rules: 'Rules',
    canonicalUrl: 'https://example.test/v1/market', refreshCatalog: vi.fn().mockResolvedValue(page),
  };
  wallet = {
    connect: vi.fn().mockResolvedValue({ account, chainId: context.chainId }),
    getSession: vi.fn().mockResolvedValue({ account, chainId: context.chainId }),
    switchChain: vi.fn().mockResolvedValue(undefined), sendTransaction: vi.fn().mockResolvedValue(hash(20)),
  };
  vi.mocked(assertMarketBinding).mockResolvedValue({ ...context, market, adjudicator: address(6) });
  vi.mocked(readSoothMarket).mockResolvedValue(data);
  vi.mocked(readFactoryQuote).mockResolvedValue({ costWad: WAD, feeWad: 0n, netWad: WAD, newPriceWad: WAD / 2n, blockNumber: 10n });
  vi.mocked(buildFactoryTransaction).mockResolvedValue({
    chainId: context.chainId, account, address: token, abi: erc20Abi, functionName: 'approve',
    args: [context.contracts.amm, 100n], to: token, data: '0x1234', value: 0n,
    verifiedBlockNumber: 10n, verifiedContext: context,
  });
  vi.mocked(saveSoothPending).mockReturnValue(true);
  vi.mocked(loadSoothPending).mockReturnValue([]);
  vi.mocked(reconcileSoothPending).mockResolvedValue({ status: 'pending' });
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('Sooth trade previews', () => {
  it.each(['0', '-1', '+1', '1e3', ' 1', '1 ', '.5', '1.', '0.0000000000000000001', '1.0000000000000000000'])('rejects invalid or rounded share input %s before reads', async shares => {
    await expect(planSoothTrade(resolved, account, { ...buy, shares })).rejects.toThrow();
    expect(readSoothMarket).not.toHaveBeenCalled();
  });
  it('rejects invalid outcomes and sides before reads', async () => {
    await expect(planSoothTrade(resolved, account, { ...buy, outcome: 2 } as unknown as SoothTradeIntent)).rejects.toThrow('outcome');
    await expect(planSoothTrade(resolved, account, { ...buy, side: 'hold' } as unknown as SoothTradeIntent)).rejects.toThrow('side');
    expect(readSoothMarket).not.toHaveBeenCalled();
  });
  it('accepts exact 18-digit shares and plans the SDK slippage bound and approval separately', async () => {
    data.account!.allowance = 100n;
    const preview = await planSoothTrade(resolved, account, { ...buy, shares: '1.000000000000000001' });
    expect(preview.action).toEqual({ kind: 'trade', outcome: 1, deltaShares: WAD + 1n, boundWad: 1_010_000_000_000_000_000n });
    expect(preview).toMatchObject({ requiredNative: 1_010_000n, approveNative: 1_010_000n, allowance: 100n, feeBps: 100 });
    expect(readFactoryQuote).toHaveBeenCalledWith(expect.objectContaining({ blockNumber: 10n, deltaShares: WAD + 1n }));
    expect(resolved.refreshCatalog).toHaveBeenCalledOnce();
    expect(buildFactoryTransaction).not.toHaveBeenCalled();
  });
  it('refreshes allowance and quote on every preview after approval', async () => {
    expect((await planSoothTrade(resolved, account, buy)).approveNative).toBe(1_010_000n);
    data.account!.allowance = 1_010_000n;
    expect((await planSoothTrade(resolved, account, buy)).approveNative).toBeNull();
    expect(assertMarketBinding).toHaveBeenCalledTimes(2);
    expect(readSoothMarket).toHaveBeenCalledTimes(2);
    expect(readFactoryQuote).toHaveBeenCalledTimes(2);
  });
  it('blocks insufficient collateral and closed markets', async () => {
    data.account!.balance = 1n;
    await expect(planSoothTrade(resolved, account, buy)).rejects.toThrow('wallet has');
    data.snapshot.tradingOpen = false;
    await expect(planSoothTrade(resolved, account, buy)).rejects.toThrow('Trading is closed');
  });
  it('uses fresh catalog policy instead of the resolved catalog', async () => {
    const hidden = catalog();
    hidden.items[0]!.listing.state = 'disabled';
    vi.mocked(resolved.refreshCatalog).mockResolvedValue(hidden);
    await expect(planSoothTrade(resolved, account, buy)).rejects.toThrow('not listed');
  });
  it('blocks stale moderation and unavailable fresh catalogs', async () => {
    const stale = catalog();
    stale.overrides.ageSeconds = 601;
    vi.mocked(resolved.refreshCatalog).mockResolvedValue(stale);
    await expect(planSoothTrade(resolved, account, buy)).rejects.toThrow('stale');
    vi.mocked(resolved.refreshCatalog).mockRejectedValue(new Error('Catalog unavailable'));
    await expect(planSoothTrade(resolved, account, buy)).rejects.toThrow('Catalog unavailable');
  });
  it('allows an exit without catalog policy and uses owned outcome shares', async () => {
    vi.mocked(resolved.refreshCatalog).mockRejectedValue(new Error('Catalog unavailable'));
    const sell = { ...buy, side: 'sell' as const, outcome: 0 as const };
    const preview = await planSoothTrade(resolved, account, sell);
    expect(preview.action).toEqual({ kind: 'trade', outcome: 0, deltaShares: -2n * WAD, boundWad: 990_000_000_000_000_000n });
    expect(preview.approveNative).toBeNull();
    expect(resolved.refreshCatalog).not.toHaveBeenCalled();
    await expect(planSoothTrade(resolved, account, { ...sell, shares: '3' })).rejects.toThrow('holds');
  });
  it('plans a bounded resting order and explicitly distinguishes placement from filling', async () => {
    resolved.reference.venue = 'book';
    const preview = await planSoothTrade(resolved, account, buy);
    expect(preview.action).toEqual({ kind: 'placeOrder', order: {
      outcome: 1, action: 0, priceTick: 500, amount: 2n * WAD, matchLimit: 32,
      validUntil: 1_300n, expiry: 10_000n, rest: true, postOnly: false, maxTokenIn: 1_010_001n, minTokenOut: 0n,
    } });
    expect(preview.approveNative).toBe(1_010_001n);
    expect(preview.description).toContain('submission does not mean it filled');
    expect(readFactoryQuote).not.toHaveBeenCalled();
  });
  it('bounds book validity by the market deadline and requires a chain clock', async () => {
    resolved.reference.venue = 'book';
    data.snapshot.deadline = 1_100n;
    const preview = await planSoothTrade(resolved, account, buy);
    expect(preview.action).toMatchObject({ order: { validUntil: 1_100n, expiry: 1_100n } });
    data.snapshot.deadline = 1_000n;
    await expect(planSoothTrade(resolved, account, buy)).rejects.toThrow('deadline');
    data.snapshot.blockTimestamp = null;
    await expect(planSoothTrade(resolved, account, { ...buy, side: 'sell' })).rejects.toThrow('timestamp');
  });
  it('enforces book price ticks, share units, and free inventory', async () => {
    resolved.reference.venue = 'book';
    for (const price of ['0', '100', '50.01', '-1', '1e1']) {
      await expect(planSoothTrade(resolved, account, { ...buy, price })).rejects.toThrow('price');
    }
    await expect(planSoothTrade(resolved, account, { ...buy, shares: '0.0000001' })).rejects.toThrow('steps');
    await expect(planSoothTrade(resolved, account, { ...buy, side: 'sell', shares: '5' })).rejects.toThrow('free YES');
    const preview = await planSoothTrade(resolved, account, { ...buy, side: 'sell', shares: '4' });
    expect(preview).toMatchObject({ requiredNative: 0n, approveNative: null, action: { order: { action: 1, minTokenOut: 0n } } });
  });
});

describe('Sooth explicit action submission', () => {
  const approval: FactoryTransactionAction = { kind: 'approve', venue: 'amm', amountNative: 100n };
  it('simulates exactly one freshly bound action and persists before notification', async () => {
    const onPending = vi.fn();
    const pending = await sendSoothAction(resolved, wallet, account, approval, onPending);
    expect(buildFactoryTransaction).toHaveBeenCalledWith(expect.objectContaining({ account, market, action: approval }));
    expect(resolved.client.simulateContract).toHaveBeenCalledWith(expect.objectContaining({ account, address: token, functionName: 'approve', args: [context.contracts.amm, 100n] }));
    expect(wallet.sendTransaction).toHaveBeenCalledOnce();
    expect(wallet.sendTransaction).toHaveBeenCalledWith({ account, chainId: 46630, to: token, data: '0x1234', value: 0n });
    expect(pending).toMatchObject({ version: 1, hash: hash(20), account, chainId: 46630, storageAvailable: true });
    expect(onPending).toHaveBeenCalledWith(pending);
    expect(saveSoothPending).toHaveBeenCalledWith(expect.objectContaining({ hash: pending.hash, data: '0x1234' }));
    expect(vi.mocked(saveSoothPending).mock.invocationCallOrder[0]).toBeLessThan(onPending.mock.invocationCallOrder[0]!);
    expect(readSoothMarket).toHaveBeenCalledOnce();
    expect(resolved.refreshCatalog).toHaveBeenCalledOnce();
  });
  it('returns the hash immediately but holds the lock until failed persistence recovers', async () => {
    vi.useFakeTimers();
    let held = false;
    vi.stubGlobal('navigator', { locks: { request: vi.fn(async (_name: string, _options: { mode: string }, run: (lock: object | null) => Promise<unknown>) => {
      held = true;
      try { return await run({}); }
      finally { held = false; }
    }) } });
    vi.mocked(saveSoothPending).mockReturnValue(false);
    const onPending = vi.fn();
    const pending = await sendSoothAction(resolved, wallet, account, approval, onPending);
    expect(pending).toMatchObject({ hash: hash(20), storageAvailable: false });
    expect(onPending).toHaveBeenCalledWith(pending);
    expect(held).toBe(true);
    await expect(sendSoothAction(resolved, wallet, account, approval, vi.fn())).rejects.toThrow('pending action');
    vi.mocked(saveSoothPending).mockReturnValue(true);
    await vi.advanceTimersByTimeAsync(4_000);
    expect(held).toBe(false);
    expect(wallet.sendTransaction).toHaveBeenCalledOnce();
  });
  it('rejects account changes after simulation before broadcasting', async () => {
    vi.mocked(resolved.client.simulateContract).mockImplementation(async () => {
      vi.mocked(wallet.getSession).mockResolvedValue({ account: address(99), chainId: 46630 });
      return { result: true } as never;
    });
    await expect(sendSoothAction(resolved, wallet, account, approval, vi.fn())).rejects.toThrow('account changed');
    expect(wallet.sendTransaction).not.toHaveBeenCalled();
    expect(saveSoothPending).not.toHaveBeenCalled();
  });
  it('rejects a chain change while binding before simulation', async () => {
    vi.mocked(wallet.getSession).mockResolvedValueOnce({ account, chainId: 46630 }).mockResolvedValue({ account, chainId: 1 });
    await expect(sendSoothAction(resolved, wallet, account, approval, vi.fn())).rejects.toThrow('chain changed');
    expect(resolved.client.simulateContract).not.toHaveBeenCalled();
    expect(wallet.sendTransaction).not.toHaveBeenCalled();
  });
  it('does not broadcast or persist rejected simulations', async () => {
    vi.mocked(resolved.client.simulateContract).mockRejectedValue(new Error('Allowance reset required'));
    await expect(sendSoothAction(resolved, wallet, account, approval, vi.fn())).rejects.toThrow('Allowance reset required');
    expect(wallet.sendTransaction).not.toHaveBeenCalled();
    expect(saveSoothPending).not.toHaveBeenCalled();
  });
  it('rechecks new exposure policy at submission and leaves exits available', async () => {
    vi.mocked(resolved.refreshCatalog).mockRejectedValue(new Error('Policy unavailable'));
    await expect(sendSoothAction(resolved, wallet, account, { kind: 'trade', outcome: 1, deltaShares: WAD, boundWad: WAD }, vi.fn())).rejects.toThrow('Policy unavailable');
    expect(wallet.sendTransaction).not.toHaveBeenCalled();
    await sendSoothAction(resolved, wallet, account, { kind: 'trade', outcome: 1, deltaShares: -WAD, boundWad: 0n }, vi.fn());
    expect(wallet.sendTransaction).toHaveBeenCalledOnce();
  });
  it('blocks trading after the market closes between preview and submission', async () => {
    data.snapshot.tradingOpen = false;
    await expect(sendSoothAction(resolved, wallet, account, { kind: 'trade', outcome: 1, deltaShares: -WAD, boundWad: 0n }, vi.fn())).rejects.toThrow('Trading is closed');
    expect(wallet.sendTransaction).not.toHaveBeenCalled();
  });
  it('rejects simultaneous submissions from separate widgets before the hash exists', async () => {
    const first = sendSoothAction(resolved, wallet, account, approval, vi.fn());
    await expect(sendSoothAction(resolved, wallet, account, approval, vi.fn())).rejects.toThrow('pending action');
    await first;
    expect(wallet.sendTransaction).toHaveBeenCalledOnce();
  });
  it('blocks stored pending actions only for the signing account', async () => {
    const pending = await sendSoothAction(resolved, wallet, account, approval, vi.fn());
    vi.mocked(loadSoothPending).mockReturnValue([pending]);
    await expect(sendSoothAction(resolved, wallet, account, approval, vi.fn())).rejects.toThrow('pending action');
    vi.mocked(loadSoothPending).mockReturnValue([{ ...pending, account: address(99) }]);
    await sendSoothAction(resolved, wallet, account, approval, vi.fn());
    expect(wallet.sendTransaction).toHaveBeenCalledTimes(2);
  });
  it('releases the submission lock when simulation fails', async () => {
    vi.mocked(resolved.client.simulateContract).mockRejectedValueOnce(new Error('Simulation failed'));
    await expect(sendSoothAction(resolved, wallet, account, approval, vi.fn())).rejects.toThrow('Simulation failed');
    await sendSoothAction(resolved, wallet, account, approval, vi.fn());
    expect(wallet.sendTransaction).toHaveBeenCalledOnce();
  });
  it('blocks nonzero approvals when fresh policy is unavailable or trading has closed', async () => {
    vi.mocked(resolved.refreshCatalog).mockRejectedValue(new Error('Policy unavailable'));
    await expect(sendSoothAction(resolved, wallet, account, approval, vi.fn())).rejects.toThrow('Policy unavailable');
    data.snapshot.tradingOpen = false;
    await expect(sendSoothAction(resolved, wallet, account, approval, vi.fn())).rejects.toThrow('Trading is closed');
    expect(wallet.sendTransaction).not.toHaveBeenCalled();
    expect(resolved.client.simulateContract).not.toHaveBeenCalled();
  });
  it('allows an explicit zero approval despite closed trading and unavailable policy', async () => {
    data.snapshot.tradingOpen = false;
    vi.mocked(resolved.refreshCatalog).mockRejectedValue(new Error('Policy unavailable'));
    const revoke = { kind: 'approve', venue: 'amm', amountNative: 0n } as const;
    await sendSoothAction(resolved, wallet, account, revoke, vi.fn());
    expect(buildFactoryTransaction).toHaveBeenCalledWith(expect.objectContaining({ action: revoke }));
    expect(wallet.sendTransaction).toHaveBeenCalledOnce();
    expect(readSoothMarket).not.toHaveBeenCalled();
    expect(resolved.refreshCatalog).not.toHaveBeenCalled();
  });
  it('returns the persisted broadcast when a host pending callback throws', async () => {
    const onPending = vi.fn(() => { throw new Error('Host notification failed'); });
    const pending = await sendSoothAction(resolved, wallet, account, approval, onPending);
    expect(pending).toMatchObject({ hash: hash(20), storageAvailable: true });
    expect(saveSoothPending).toHaveBeenCalledWith(expect.objectContaining({ hash: hash(20) }));
    expect(onPending).toHaveBeenCalledWith(pending);
    expect(wallet.sendTransaction).toHaveBeenCalledOnce();
  });
  it('fails before signing when Web Locks are unavailable', async () => {
    vi.stubGlobal('navigator', {});
    await expect(sendSoothAction(resolved, wallet, account, approval, vi.fn())).rejects.toThrow('cannot coordinate');
    expect(buildFactoryTransaction).not.toHaveBeenCalled();
    expect(wallet.sendTransaction).not.toHaveBeenCalled();
  });
  it('fails before signing when durable pending storage is unavailable', async () => {
    vi.mocked(canPersistSoothPending).mockReturnValue(false);
    await expect(sendSoothAction(resolved, wallet, account, approval, vi.fn())).rejects.toThrow('storage is unavailable');
    expect(buildFactoryTransaction).not.toHaveBeenCalled();
    expect(wallet.sendTransaction).not.toHaveBeenCalled();
  });
  it('checks storage again after simulation before asking the wallet to sign', async () => {
    vi.mocked(canPersistSoothPending).mockReturnValueOnce(true).mockReturnValue(false);
    await expect(sendSoothAction(resolved, wallet, account, approval, vi.fn())).rejects.toThrow('storage is unavailable');
    expect(resolved.client.simulateContract).toHaveBeenCalledOnce();
    expect(wallet.sendTransaction).not.toHaveBeenCalled();
  });
  it('refuses a competing window immediately and never queues its confirmation', async () => {
    const requestLock = vi.fn(async (_name: string, _options: { mode: string; ifAvailable: boolean }, run: (lock: object | null) => Promise<unknown>) => run(null));
    vi.stubGlobal('navigator', { locks: { request: requestLock } });
    await expect(sendSoothAction(resolved, wallet, account, approval, vi.fn())).rejects.toThrow('Another window');
    expect(requestLock).toHaveBeenCalledWith(`sooth:submit:${formatSoothMarketReference(resolved.reference)}:${account}`, { mode: 'exclusive', ifAvailable: true }, expect.any(Function));
    expect(loadSoothPending).not.toHaveBeenCalled();
    expect(buildFactoryTransaction).not.toHaveBeenCalled();
    expect(wallet.sendTransaction).not.toHaveBeenCalled();
  });
  it('rejects lowercase stored pending records for a checksum caller holding the lock', async () => {
    const storedAccount = '0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc' as Address;
    const checksumAccount = getAddress(storedAccount);
    expect(checksumAccount).not.toBe(storedAccount);
    const fullMarket = formatSoothMarketReference(resolved.reference);
    vi.mocked(loadSoothPending).mockReturnValue([{
      version: 1, market: fullMarket, account: storedAccount, chainId: 46630, hash: hash(99),
      to: token, data: '0x1234', submittedAt: Date.now(), label: 'Other window approval',
    }]);
    await expect(sendSoothAction(resolved, wallet, checksumAccount, approval, vi.fn())).rejects.toThrow('pending action');
    expect(navigator.locks.request).toHaveBeenCalledWith(`sooth:submit:${fullMarket}:${storedAccount}`, { mode: 'exclusive', ifAvailable: true }, expect.any(Function));
    expect(buildFactoryTransaction).not.toHaveBeenCalled();
    expect(wallet.sendTransaction).not.toHaveBeenCalled();
  });
  it('rechecks pending evidence after simulation immediately before signing', async () => {
    vi.mocked(resolved.client.simulateContract).mockImplementation(async () => {
      vi.mocked(loadSoothPending).mockReturnValue([{
        version: 1, market: formatSoothMarketReference(resolved.reference), account,
        chainId: 46630, hash: hash(99), to: token, data: '0x1234', submittedAt: Date.now(), label: 'Other window approval',
      }]);
      return { result: true } as never;
    });
    await expect(sendSoothAction(resolved, wallet, account, approval, vi.fn())).rejects.toThrow('pending action');
    expect(resolved.client.simulateContract).toHaveBeenCalledOnce();
    expect(wallet.sendTransaction).not.toHaveBeenCalled();
  });
  it('holds the exclusive lock through hash persistence and releases it afterward', async () => {
    let held = false;
    vi.stubGlobal('navigator', { locks: { request: vi.fn(async (_name: string, _options: { mode: string }, run: (lock: object | null) => Promise<unknown>) => {
      held = true;
      try { return await run({}); }
      finally { held = false; }
    }) } });
    vi.mocked(wallet.sendTransaction).mockImplementation(async () => {
      expect(held).toBe(true);
      return hash(20);
    });
    vi.mocked(saveSoothPending).mockImplementation(() => {
      expect(held).toBe(true);
      return true;
    });
    await sendSoothAction(resolved, wallet, account, approval, vi.fn());
    expect(saveSoothPending).toHaveBeenCalledOnce();
    expect(held).toBe(false);
  });
  it('retains the lock through pending or unavailable receipts and releases on confirmed evidence', async () => {
    vi.useFakeTimers();
    let held = false;
    vi.stubGlobal('navigator', { locks: { request: vi.fn(async (_name: string, _options: { mode: string }, run: (lock: object | null) => Promise<unknown>) => {
      held = true;
      try { return await run({}); }
      finally { held = false; }
    }) } });
    vi.mocked(saveSoothPending).mockReturnValue(false);
    await sendSoothAction(resolved, wallet, account, approval, vi.fn());
    await vi.advanceTimersByTimeAsync(4_000);
    expect(held).toBe(true);
    vi.mocked(reconcileSoothPending).mockRejectedValueOnce(new Error('RPC unavailable'));
    await vi.advanceTimersByTimeAsync(4_000);
    expect(held).toBe(true);
    vi.mocked(reconcileSoothPending).mockResolvedValue({ status: 'confirmed', receipt: { blockNumber: 11n } as TransactionReceipt });
    await vi.advanceTimersByTimeAsync(4_000);
    expect(held).toBe(false);
    expect(wallet.sendTransaction).toHaveBeenCalledOnce();
  });
});
