// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, within, type BoundFunctions, type queries } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Address, Hex } from 'viem';
import { SoothMarket } from '../../src/react/SoothMarket.js';
import { useSoothMarket, useSoothTransactionRecovery, useSoothWallet } from '../../src/react/hooks.js';
import {
  useSoothDepth, useSoothLiquidity, useSoothLiveQuote, useSoothMarketSummary, useSoothPriceHistory,
} from '../../src/react/dataHooks.js';
import {
  planSoothAddLiquidity, type SoothLiquidity, type SoothLiquidityPreview, type SoothLiveQuote,
} from '../../src/react/data.js';
import { formatSoothMarketReference } from '../../src/react/embed.js';
import type { SoothMarketData, SoothResolvedMarket } from '../../src/react/runtime.js';
import { planSoothTrade, sendSoothAction, type SoothTradePreview } from '../../src/react/trading.js';
import type { SoothWalletAdapter } from '../../src/react/wallet.js';

vi.mock('../../src/react/hooks.js', () => ({
  useSoothWallet: vi.fn(),
  useSoothMarket: vi.fn(),
  useSoothTransactionRecovery: vi.fn(),
}));
vi.mock('../../src/react/trading.js', () => ({
  planSoothTrade: vi.fn(),
  sendSoothAction: vi.fn(),
}));
vi.mock('../../src/react/dataHooks.js', () => ({
  useSoothPriceHistory: vi.fn(),
  useSoothDepth: vi.fn(),
  useSoothLiveQuote: vi.fn(),
  useSoothLiquidity: vi.fn(),
  useSoothMarketSummary: vi.fn(),
}));
vi.mock('../../src/react/data.js', () => ({
  planSoothAddLiquidity: vi.fn(),
}));

const address = (n: number) => `0x${n.toString(16).padStart(40, '0')}` as Address;
const hash = (n: number) => `0x${n.toString(16).padStart(64, '0')}` as Hex;
const account = address(4);
// Only the resolved identity and spender are consumed at this mocked hook boundary.
const resolved = {
  reference: {
    chainId: 46630, factory: address(1), releaseId: hash(1), nodeId: hash(2),
    market: address(3), venue: 'amm',
  },
  context: { contracts: { amm: address(5) } },
  question: 'Will the proposal pass?',
  rules: 'Resolves YES if the proposal passes before the deadline.',
  canonicalUrl: 'https://example.test/market',
  record: { question: 'Will the proposal pass?' },
} as SoothResolvedMarket;
const wallet: SoothWalletAdapter = {
  connect: vi.fn(), getSession: vi.fn(), switchChain: vi.fn(), sendTransaction: vi.fn(),
};
const props = {
  market: resolved.reference,
  wallet,
  initialIntent: { side: 'buy', outcome: 1, shares: '10', price: '50' } as const,
};
let data: SoothMarketData;
let marketState: {
  resolved: SoothResolvedMarket;
  data: SoothMarketData;
  error: null;
  loading: boolean;
  updatedAt: number;
  refresh: () => void;
};

function preview(amount: bigint, allowance = 0n): SoothTradePreview {
  const boundWad = amount * 10n ** 12n;
  return {
    action: { kind: 'trade', outcome: 1, deltaShares: 10n ** 19n, boundWad },
    approveNative: amount, allowance, requiredNative: amount, boundWad, feeBps: 100,
    description: 'Buy 10 YES shares using the live AMM quote with a 1% slippage bound.',
    data: { ...data, account: { ...data.account!, allowance } },
  };
}

function renderMarket(market = props.market) {
  const view = render(<SoothMarket {...props} market={market} />);
  const host = view.container.querySelector('[data-sooth-market]');
  expect(host?.shadowRoot).not.toBeNull();
  const region = host!.shadowRoot!.querySelector<HTMLElement>('[aria-label="Sooth prediction market"]');
  expect(region).not.toBeNull();
  const ui = within(region!);
  return { ...view, ui, region: region! };
}

async function click(button: HTMLElement) {
  await act(async () => { fireEvent.click(button); });
}

beforeEach(() => {
  vi.resetAllMocks();
  data = {
    snapshot: {
      market: resolved.reference.market, blockNumber: 10n, blockTimestamp: 1_800_000_000n,
      deadline: 1_900_000_000n, tradingOpen: true, settled: false, isResolving: false,
      outcome: 0, ammFeeBps: 100, yesPriceWad: 625_000_000_000_000_000n,
    } as SoothMarketData['snapshot'],
    token: { address: address(6), decimals: 6, symbol: 'TEST' },
    account: {
      address: account, balance: 100_000_000n, allowance: 0n,
      positions: {
        blockNumber: 10n, complete: true,
        positions: [{ market: resolved.reference.market, account, yes: 0n, no: 0n, blockNumber: 10n }],
      },
      entitlements: { blockNumber: 10n, floorWad: 0n, bookTimeoutRefundNative: null, bookDeferredNative: null },
    },
  };
  marketState = { resolved, data, error: null, loading: false, updatedAt: 1_800_000_000_000, refresh: vi.fn() };
  vi.mocked(useSoothMarket).mockImplementation(() => marketState);
  vi.mocked(useSoothWallet).mockReturnValue({
    adapter: wallet, session: { account, chainId: resolved.reference.chainId },
    error: null, connect: vi.fn(), switchChain: vi.fn(),
  });
  vi.mocked(useSoothTransactionRecovery).mockReturnValue({
    pending: [], events: [], error: null, result: null, addPending: vi.fn(),
  });
  for (const hook of [useSoothPriceHistory, useSoothDepth, useSoothLiveQuote, useSoothLiquidity, useSoothMarketSummary])
    vi.mocked(hook).mockReturnValue(idle());
  vi.mocked(sendSoothAction).mockResolvedValue({
    version: 1, market: formatSoothMarketReference(resolved.reference), account,
    chainId: resolved.reference.chainId, hash: hash(3), to: data.token.address,
    data: '0x1234', submittedAt: 1_800_000_000_000, label: 'Approve collateral', storageAvailable: true,
  });
});
afterEach(cleanup);

function idle() {
  return { data: null, error: null, loading: false, refresh: vi.fn() };
}

/** Error notices carry a decorative icon; compare the announced message only. */
function alertText(ui: BoundFunctions<typeof queries>) {
  return ui.getByRole('alert').querySelector('.s-notice-body')?.textContent;
}

const changedMessage = 'The approval amount or reset step changed. Review the updated authorization and confirm again.';

describe('SoothMarket embedded ticket', () => {
  it('shows the live AMM probability and reviews the selected side and outcome in shares', async () => {
    vi.mocked(planSoothTrade).mockResolvedValue(preview(5_000_000n));
    const { ui } = renderMarket();
    expect(ui.getByRole('heading', { name: resolved.question })).toBeTruthy();
    expect(ui.getByText('Live AMM probability')).toBeTruthy();
    expect(ui.getByText('62.5%')).toBeTruthy();
    expect(ui.getByRole('radio', { name: 'YES', checked: true })).toBeTruthy();
    await click(ui.getByRole('radio', { name: 'NO' }));
    await click(ui.getByRole('radio', { name: 'Sell' }));
    expect(ui.getByRole('radio', { name: 'NO', checked: true })).toBeTruthy();
    expect(ui.getByRole('radio', { name: 'Sell', checked: true })).toBeTruthy();
    await click(ui.getByRole('button', { name: 'Review sell' }));
    expect(planSoothTrade).toHaveBeenCalledWith(resolved, account, {
      ...props.initialIntent, side: 'sell', outcome: 0,
    });
    expect(ui.getByRole('button', { name: 'Market and wallet details' }).getAttribute('aria-expanded')).toBe('false');
    expect(ui.getByRole('button', { name: 'Resolution rules' }).getAttribute('aria-expanded')).toBe('false');
  });

  it('has one outcome control: the YES/NO toggle shows the prices, with no price cards beside it', () => {
    const { ui, region } = renderMarket();
    expect(ui.getAllByRole('radio', { name: 'YES' })).toHaveLength(1);
    expect(ui.getAllByRole('radio', { name: 'NO' })).toHaveLength(1);
    expect(ui.queryByRole('button', { name: /^Buy (YES|NO) at/ })).toBeNull();
    expect(region.querySelector('.s-price-cards')).toBeNull();
    expect(ui.getByRole('radio', { name: 'YES' }).textContent).toBe('YES62.5¢');
    expect(ui.getByRole('radio', { name: 'NO' }).textContent).toBe('NO37.5¢');
  });

  it('does not invent a probability when the live price is unavailable', () => {
    marketState = { ...marketState, data: { ...data, snapshot: { ...data.snapshot, yesPriceWad: -1n } } };
    const { ui } = renderMarket();
    expect(ui.getByText('Probability unavailable')).toBeTruthy();
    expect(ui.queryByText('50%')).toBeNull();
  });

  it('offers one wallet connection action in place of review', async () => {
    const connect = vi.fn();
    vi.mocked(useSoothWallet).mockReturnValue({
      adapter: wallet, session: null, error: null, connect, switchChain: vi.fn(),
    });
    marketState = { ...marketState, data: { ...data, account: undefined } };
    const { ui } = renderMarket();
    expect(ui.getAllByRole('button', { name: 'Connect wallet' })).toHaveLength(1);
    expect(ui.queryByRole('button', { name: 'Review buy' })).toBeNull();
    await click(ui.getByRole('button', { name: 'Connect wallet' }));
    expect(connect).toHaveBeenCalledOnce();
    expect(planSoothTrade).not.toHaveBeenCalled();
  });

  it.each([
    { isResolving: false, message: 'Trading is closed. Awaiting the final result.' },
    { isResolving: true, message: 'Resolution is in progress. Trading is closed.' },
  ])('replaces the closed ticket with its resolution state: $message', ({ isResolving, message }) => {
    marketState = {
      ...marketState, data: { ...data, snapshot: { ...data.snapshot, tradingOpen: false, isResolving } },
    };
    const { ui, region } = renderMarket();
    expect(ui.getByText(message)).toBeTruthy();
    expect(ui.queryByRole('form', { name: 'Trade shares' })).toBeNull();
    expect(ui.queryByRole('textbox', { name: 'Shares' })).toBeNull();
    expect(ui.queryByRole('button', { name: 'Review buy' })).toBeNull();
    expect(ui.getByRole('heading', { name: 'Your positions' })).toBeTruthy();
    // No trade panel: the price cards show the last prices, and pick nothing.
    expect(region.querySelectorAll('.s-price-cards .s-price-card-static')).toHaveLength(2);
    expect(region.querySelector('.s-price-cards button')).toBeNull();
  });

  it.each([
    { outcome: 1 as const, result: 'YES' },
    { outcome: 0 as const, result: 'NO' },
    { outcome: 2 as const, result: 'INVALID' },
  ])('shows the settled $result result without a trade ticket or probability', ({ outcome, result }) => {
    marketState = {
      ...marketState, data: { ...data, snapshot: { ...data.snapshot, settled: true, outcome, tradingOpen: false } },
    };
    const { ui } = renderMarket();
    expect(ui.getByRole('heading', { name: `Resolved: ${result}` })).toBeTruthy();
    expect(ui.queryByRole('form', { name: 'Trade shares' })).toBeNull();
    expect(ui.queryByText('Live AMM probability')).toBeNull();
    expect(ui.getByRole('heading', { name: 'Your positions' })).toBeTruthy();
  });

  it('discards an in-flight authorization when the market closes', async () => {
    const reviewed = preview(5_000_000n);
    let resolvePlan!: (value: SoothTradePreview) => void;
    const pendingPlan = new Promise<SoothTradePreview>((resolve) => { resolvePlan = resolve; });
    vi.mocked(planSoothTrade).mockResolvedValueOnce(reviewed).mockReturnValueOnce(pendingPlan);
    const { ui, rerender } = renderMarket();
    await click(ui.getByRole('button', { name: 'Review buy' }));
    await click(ui.getByRole('button', { name: 'Approve exact amount' }));
    marketState = { ...marketState, data: { ...data, snapshot: { ...data.snapshot, tradingOpen: false } } };
    rerender(<SoothMarket {...props} />);
    await act(async () => { resolvePlan(reviewed); });
    expect(sendSoothAction).not.toHaveBeenCalled();
    expect(ui.queryByRole('region', { name: 'Trade review' })).toBeNull();
    expect(ui.queryByRole('button', { name: 'Approve exact amount' })).toBeNull();
    marketState = { ...marketState, data };
    rerender(<SoothMarket {...props} />);
    expect(ui.queryByRole('region', { name: 'Trade review' })).toBeNull();
    expect(ui.getByRole('button', { name: 'Review buy' })).toBeTruthy();
  });
  it.each(['approval', 'trade'] as const)('cancels pending %s planning when the view unmounts', async (operation) => {
    const reviewed = { ...preview(5_000_000n), ...(operation === 'trade' ? { approveNative: null } : {}) };
    let resolvePlan!: (value: SoothTradePreview) => void;
    const pendingPlan = new Promise<SoothTradePreview>((resolve) => { resolvePlan = resolve; });
    vi.mocked(planSoothTrade).mockResolvedValueOnce(reviewed).mockReturnValueOnce(pendingPlan);
    const { ui, unmount } = renderMarket();
    await click(ui.getByRole('button', { name: 'Review buy' }));
    await click(ui.getByRole('button', { name: operation === 'approval' ? 'Approve exact amount' : 'Confirm buy' }));
    unmount();
    await act(async () => { resolvePlan(reviewed); });
    expect(sendSoothAction).not.toHaveBeenCalled();
  });

  it('blocks a claim at the wallet boundary after the view unmounts', async () => {
    marketState = {
      ...marketState, data: { ...data, account: {
        ...data.account!, entitlements: { ...data.account!.entitlements, floorWad: 10n ** 18n },
      } },
    };
    const { ui, unmount } = renderMarket();
    await click(ui.getByRole('button', { name: 'Claim floor entitlement' }));
    const guardedWallet = vi.mocked(sendSoothAction).mock.calls[0]![1];
    unmount();
    expect(() => guardedWallet.sendTransaction({
      account, chainId: resolved.reference.chainId, to: address(5), data: '0x1234', value: 0n,
    })).toThrow('The market view or transaction intent changed');
    expect(wallet.sendTransaction).not.toHaveBeenCalled();
  });

  it('forwards an authorized request while mounted and retains a dispatched result after closing', async () => {
    let resolveHash!: (value: Hex) => void;
    const pendingHash = new Promise<Hex>((resolve) => { resolveHash = resolve; });
    vi.mocked(wallet.sendTransaction).mockReturnValueOnce(pendingHash);
    vi.mocked(planSoothTrade).mockResolvedValue(preview(5_000_000n));
    const { ui, unmount } = renderMarket();
    await click(ui.getByRole('button', { name: 'Review buy' }));
    await click(ui.getByRole('button', { name: 'Approve exact amount' }));
    const guardedWallet = vi.mocked(sendSoothAction).mock.calls[0]![1];
    const request = { account, chainId: resolved.reference.chainId, to: address(5), data: '0x1234' as const, value: 0n };
    const sent = guardedWallet.sendTransaction(request);
    expect(wallet.sendTransaction).toHaveBeenCalledWith(request);
    unmount();
    resolveHash(hash(9));
    await expect(sent).resolves.toBe(hash(9));
  });
});

describe('SoothMarket approval review in shadow DOM', () => {
  it('requires confirmation of a changed approval amount and sends exactly the newly reviewed cap', async () => {
    vi.mocked(planSoothTrade)
      .mockResolvedValueOnce(preview(5_000_000n))
      .mockResolvedValueOnce(preview(6_250_000n))
      .mockResolvedValueOnce(preview(6_250_000n));
    const { ui } = renderMarket();

    await click(ui.getByRole('button', { name: 'Review buy' }));
    expect(ui.getByText(/approved for the verified/).textContent).toMatch(/\b5(?:\.0+)?\s+TEST\b/);
    expect(sendSoothAction).not.toHaveBeenCalled();

    await click(ui.getByRole('button', { name: 'Approve exact amount' }));
    expect(sendSoothAction).not.toHaveBeenCalled();
    expect(alertText(ui)).toBe(changedMessage);
    expect(ui.getByText(/approved for the verified/).textContent).toMatch(/\b6\.250*\s+TEST\b/);
    expect(ui.getByText(/approved for the verified/).textContent).not.toMatch(/\b5(?:\.0+)?\s+TEST\b/);

    await click(ui.getByRole('button', { name: 'Approve exact amount' }));
    expect(planSoothTrade).toHaveBeenCalledTimes(3);
    expect(planSoothTrade).toHaveBeenLastCalledWith(resolved, account, props.initialIntent);
    expect(sendSoothAction).toHaveBeenCalledTimes(1);
    expect(sendSoothAction).toHaveBeenCalledWith(resolved, expect.objectContaining({ sendTransaction: expect.any(Function) }), account, {
      kind: 'approve', venue: 'amm', amountNative: 6_250_000n,
    }, expect.any(Function));
    expect(ui.queryByRole('alert')).toBeNull();
  });

  it.each([
    { button: 'Approve unlimited TEST', amount: (1n << 256n) - 1n },
    { button: 'Approve exact amount', amount: 5_000_000n },
  ])('approves the reviewed buy: $button', async ({ button, amount }) => {
    vi.mocked(planSoothTrade).mockResolvedValue(preview(5_000_000n));
    const { ui } = renderMarket();
    await click(ui.getByRole('button', { name: 'Review buy' }));
    expect(ui.getByText(/one approval covers your later trades/)).toBeTruthy();
    await click(ui.getByRole('button', { name: button }));
    expect(sendSoothAction).toHaveBeenCalledTimes(1);
    expect(sendSoothAction).toHaveBeenCalledWith(resolved, expect.objectContaining({ sendTransaction: expect.any(Function) }), account, {
      kind: 'approve', venue: 'amm', amountNative: amount,
    }, expect.any(Function));
  });

  it('offers only the zero reset, never unlimited, while an insufficient allowance exists', async () => {
    vi.mocked(planSoothTrade).mockResolvedValue(preview(5_000_000n, 1_000_000n));
    const { ui } = renderMarket();
    await click(ui.getByRole('button', { name: 'Review buy' }));
    expect(ui.getByRole('button', { name: 'Reset allowance to zero' })).toBeTruthy();
    expect(ui.queryByRole('button', { name: /Approve unlimited/ })).toBeNull();
    expect(ui.queryByRole('button', { name: 'Approve exact amount' })).toBeNull();
  });

  it.each([
    { from: 0n, to: 1_000_000n, first: 'Approve exact amount', next: 'Reset allowance to zero', amount: 0n },
    { from: 1_000_000n, to: 0n, first: 'Reset allowance to zero', next: 'Approve exact amount', amount: 5_000_000n },
  ])('requires reconfirmation when $first changes to $next with the same cap', async ({ from, to, first, next, amount }) => {
    vi.mocked(planSoothTrade)
      .mockResolvedValueOnce(preview(5_000_000n, from))
      .mockResolvedValueOnce(preview(5_000_000n, to))
      .mockResolvedValueOnce(preview(5_000_000n, to));
    const { ui } = renderMarket();

    await click(ui.getByRole('button', { name: 'Review buy' }));
    await click(ui.getByRole('button', { name: first }));
    expect(sendSoothAction).not.toHaveBeenCalled();
    expect(alertText(ui)).toBe(changedMessage);
    expect(ui.getByText(/approved for the verified/).textContent).toMatch(/\b5(?:\.0+)?\s+TEST\b/);
    expect(ui.queryByRole('button', { name: first })).toBeNull();
    expect(Boolean(ui.queryByText(/Reset the existing insufficient allowance to zero first/))).toBe(to > 0n);

    await click(ui.getByRole('button', { name: next }));
    expect(planSoothTrade).toHaveBeenCalledTimes(3);
    expect(sendSoothAction).toHaveBeenCalledTimes(1);
    expect(sendSoothAction).toHaveBeenCalledWith(resolved, expect.objectContaining({ sendTransaction: expect.any(Function) }), account, {
      kind: 'approve', venue: 'amm', amountNative: amount,
    }, expect.any(Function));
  });

  it('preserves the reviewed authorization when the same market props receive a fresh chain read', async () => {
    vi.mocked(planSoothTrade).mockResolvedValue(preview(5_000_000n));
    const { ui, rerender } = renderMarket();
    await click(ui.getByRole('button', { name: 'Review buy' }));
    expect(ui.getByRole('region', { name: 'Trade review' })).toBeTruthy();

    marketState = {
      ...marketState,
      data: { ...data, snapshot: { ...data.snapshot, blockNumber: 11n } },
      updatedAt: marketState.updatedAt! + 15_000,
    };
    rerender(<SoothMarket {...props} />);

    expect(ui.getByRole('region', { name: 'Trade review' })).toBeTruthy();
    expect(ui.getByText(/approved for the verified/).textContent).toMatch(/\b5(?:\.0+)?\s+TEST\b/);
    expect(ui.getByRole('button', { name: 'Approve exact amount' })).toBeTruthy();
    expect(planSoothTrade).toHaveBeenCalledTimes(1);
    expect(sendSoothAction).not.toHaveBeenCalled();
    expect(ui.queryByRole('alert')).toBeNull();
  });
});

describe('SoothMarket trade confirmation', () => {
  it('rejects an old plan when shares change while confirmation is awaiting a fresh quote', async () => {
    const reviewed = { ...preview(5_000_000n, 5_000_000n), approveNative: null };
    let resolvePlan!: (value: SoothTradePreview) => void;
    const pendingPlan = new Promise<SoothTradePreview>((resolve) => { resolvePlan = resolve; });
    vi.mocked(planSoothTrade)
      .mockResolvedValueOnce(reviewed)
      .mockReturnValueOnce(pendingPlan);
    const { ui } = renderMarket();

    await click(ui.getByRole('button', { name: 'Review buy' }));
    await click(ui.getByRole('button', { name: 'Confirm buy' }));
    expect(planSoothTrade).toHaveBeenCalledTimes(2);
    expect(planSoothTrade).toHaveBeenLastCalledWith(resolved, account, props.initialIntent);
    expect(sendSoothAction).not.toHaveBeenCalled();

    fireEvent.change(ui.getByRole('textbox', { name: 'Shares' }), { target: { value: '20' } });
    expect(ui.queryByRole('region', { name: 'Trade review' })).toBeNull();
    await act(async () => { resolvePlan(reviewed); });

    expect(sendSoothAction).not.toHaveBeenCalled();
    expect(alertText(ui)).toBe('Trade inputs changed. Review the trade again before signing.');
    expect((ui.getByRole('textbox', { name: 'Shares' }) as HTMLInputElement).value).toBe('20');
    expect(ui.queryByRole('button', { name: 'Confirm buy' })).toBeNull();
    expect((ui.getByRole('button', { name: 'Review buy' }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('SoothMarket timeout refund availability', () => {
  it.each([
    { name: 'live accrued refund', settled: false, settlementKind: 0, blockTimestamp: 1_800_000_000n, visible: false },
    { name: 'adjudicated market past timeout', settled: true, settlementKind: 1, blockTimestamp: 1_900_000_101n, visible: false },
    { name: 'invalidated market', settled: true, settlementKind: 2, blockTimestamp: 1_900_000_101n, visible: true },
    { name: 'unsettled market at the timeout boundary', settled: false, settlementKind: 0, blockTimestamp: 1_900_000_100n, visible: true },
    { name: 'unsettled market without a chain clock', settled: false, settlementKind: 0, blockTimestamp: null, visible: false },
  ])('gates a nonzero entitlement for a $name', async ({ settled, settlementKind, blockTimestamp, visible }) => {
    const book: SoothResolvedMarket = {
      ...resolved,
      reference: { ...resolved.reference, venue: 'book' },
    };
    const bookData: SoothMarketData = {
      ...data,
      snapshot: {
        ...data.snapshot, settled, settlementKind, blockTimestamp,
        permissionlessInvalidationAt: 1_900_000_100n,
        tradingOpen: !settled && blockTimestamp !== null && blockTimestamp < data.snapshot.deadline,
      },
      account: {
        ...data.account!,
        positions: undefined,
        inventory: {
          blockNumber: 10n, account, bookToken: data.token.address, bookTokenDecimals: 6,
          shareUnit: 10n ** 18n, yesOwned: 0n, noOwned: 0n, yesReserved: 0n,
          noReserved: 0n, cashReserved: 0n, balance: 100_000_000n, allowance: 0n,
        },
        entitlements: { ...data.account!.entitlements, bookTimeoutRefundNative: 2_000_000n },
      },
    };
    marketState = { ...marketState, resolved: book, data: bookData };
    const { ui } = renderMarket(book.reference);
    const claim = ui.queryByRole('button', { name: 'Claim timeout refund' });

    expect(claim !== null).toBe(visible);
    expect(sendSoothAction).not.toHaveBeenCalled();
    if (visible) {
      expect((claim as HTMLButtonElement).disabled).toBe(false);
      await click(claim!);
      expect(sendSoothAction).toHaveBeenCalledTimes(1);
      expect(sendSoothAction).toHaveBeenCalledWith(book, expect.objectContaining({ sendTransaction: expect.any(Function) }), account, {
        kind: 'claimTimeoutRefund',
      }, expect.any(Function));
    }
  });
});

describe('SoothMarket settled position eligibility', () => {
  function settledData(venue: 'amm' | 'book', yes: bigint, no: bigint): SoothMarketData {
    return {
      ...data,
      snapshot: { ...data.snapshot, settled: true, settlementKind: 1, outcome: 1, tradingOpen: false },
      account: {
        ...data.account!,
        positions: venue === 'amm' ? {
          blockNumber: 10n, complete: true,
          positions: [{ market: resolved.reference.market, account, yes, no, blockNumber: 10n }],
        } : undefined,
        inventory: venue === 'book' ? {
          blockNumber: 10n, account, bookToken: data.token.address, bookTokenDecimals: 6,
          shareUnit: 10n ** 18n, yesOwned: yes, noOwned: no, yesReserved: 0n,
          noReserved: 0n, cashReserved: 0n, balance: 100_000_000n, allowance: 0n,
        } : undefined,
      },
    };
  }

  it.each([
    { venue: 'amm' as const, holdings: 'equal YES and NO', yes: 10n ** 18n, no: 10n ** 18n },
    { venue: 'book' as const, holdings: 'equal YES and NO', yes: 10n ** 18n, no: 10n ** 18n },
    { venue: 'amm' as const, holdings: 'only losing NO', yes: 0n, no: 10n ** 18n },
    { venue: 'book' as const, holdings: 'only losing NO', yes: 0n, no: 10n ** 18n },
  ])('settles $venue positions with $holdings shares and hides the claim after balances reach zero', async ({ venue, yes, no }) => {
    const selected: SoothResolvedMarket = {
      ...resolved, reference: { ...resolved.reference, venue },
    };
    marketState = { ...marketState, resolved: selected, data: settledData(venue, yes, no) };
    const { ui, rerender } = renderMarket(selected.reference);
    const name = venue === 'amm' ? 'Claim settled AMM position' : 'Claim settled order book position';
    const claim = ui.getByRole('button', { name });
    expect((claim as HTMLButtonElement).disabled).toBe(false);

    await click(claim);
    expect(sendSoothAction).toHaveBeenCalledTimes(1);
    expect(sendSoothAction).toHaveBeenCalledWith(selected, expect.objectContaining({ sendTransaction: expect.any(Function) }), account, {
      kind: 'settlePosition', venue,
    }, expect.any(Function));

    marketState = {
      ...marketState, data: settledData(venue, 0n, 0n), updatedAt: marketState.updatedAt + 15_000,
    };
    rerender(<SoothMarket {...props} market={selected.reference} />);

    expect(ui.queryByRole('button', { name })).toBeNull();
    expect(sendSoothAction).toHaveBeenCalledTimes(1);
    expect(planSoothTrade).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'fully reserved shares', shares: 10n ** 18n, deferred: 0n },
    { name: 'deferred collateral without shares', shares: 0n, deferred: 2_000_000n },
    { name: 'fully reserved shares and deferred collateral', shares: 10n ** 18n, deferred: 2_000_000n },
  ])('does not offer position settlement for $name', async ({ shares, deferred }) => {
    const book: SoothResolvedMarket = {
      ...resolved, reference: { ...resolved.reference, venue: 'book' },
    };
    const bookData = settledData('book', shares, shares);
    bookData.account!.inventory!.yesReserved = shares;
    bookData.account!.inventory!.noReserved = shares;
    bookData.account!.entitlements = {
      ...bookData.account!.entitlements, bookDeferredNative: deferred,
    };
    marketState = { ...marketState, resolved: book, data: bookData };
    const { ui } = renderMarket(book.reference);

    expect(ui.queryByRole('button', { name: 'Claim settled order book position' })).toBeNull();
    expect(sendSoothAction).not.toHaveBeenCalled();
    const claimDeferred = ui.queryByRole('button', { name: 'Claim deferred collateral' });
    expect(claimDeferred !== null).toBe(deferred > 0n);
    if (deferred > 0n) {
      expect((claimDeferred as HTMLButtonElement).disabled).toBe(false);
      await click(claimDeferred!);
      expect(sendSoothAction).toHaveBeenCalledTimes(1);
      expect(sendSoothAction).toHaveBeenCalledWith(book, expect.objectContaining({ sendTransaction: expect.any(Function) }), account, {
        kind: 'claimDeferred',
      }, expect.any(Function));
      expect(ui.queryByRole('button', { name: 'Claim settled order book position' })).toBeNull();
    }
  });
});

const bookMarket: SoothResolvedMarket = { ...resolved, reference: { ...resolved.reference, venue: 'book' } };

function bookData(account: Partial<NonNullable<SoothMarketData['account']>> = {}): SoothMarketData {
  return {
    ...data,
    snapshot: { ...data.snapshot, shareUnit: 10n ** 18n, bookFeeBps: 50 } as SoothMarketData['snapshot'],
    account: {
      ...data.account!,
      positions: undefined,
      inventory: {
        blockNumber: 10n, account, bookToken: data.token.address, bookTokenDecimals: 6,
        shareUnit: 10n ** 18n, yesOwned: 0n, noOwned: 0n, yesReserved: 0n,
        noReserved: 0n, cashReserved: 0n, balance: 100_000_000n, allowance: 0n,
      },
      entitlements: { ...data.account!.entitlements, floorWad: null, bookTimeoutRefundNative: 0n, bookDeferredNative: 0n },
      ...account,
    },
  };
}

function liveQuote(overrides: Partial<SoothLiveQuote> = {}): SoothLiveQuote {
  return {
    side: 'buy', outcome: 1, shares: 10n ** 19n, amountNative: 6_100_000n, feeNative: 61_000n,
    averagePrice: 0.6, priceBefore: 0.625, priceAfter: 0.64, priceImpact: 0.015, blockNumber: 10n,
    ...overrides,
  };
}

describe('SoothMarket live quote', () => {
  it('shows the display quote before review and signs only the freshly planned trade', async () => {
    vi.mocked(useSoothLiveQuote).mockReturnValue({ ...idle(), data: liveQuote() });
    const reviewed = { ...preview(5_000_000n, 5_000_000n), approveNative: null };
    vi.mocked(planSoothTrade).mockResolvedValue(reviewed);
    const { ui } = renderMarket();

    const quote = ui.getByRole('region', { name: 'Live quote' });
    expect(within(quote).getByText('You pay')).toBeTruthy();
    expect(quote.textContent).toMatch(/6\.1000 TEST/);
    expect(quote.textContent).toMatch(/62\.5% → 64\.0%/);
    expect(useSoothLiveQuote).toHaveBeenLastCalledWith(resolved, props.initialIntent);
    expect(planSoothTrade).not.toHaveBeenCalled();
    expect(sendSoothAction).not.toHaveBeenCalled();

    await click(ui.getByRole('button', { name: 'Review buy' }));
    expect(ui.queryByRole('region', { name: 'Live quote' })).toBeNull();
    await click(ui.getByRole('button', { name: 'Confirm buy' }));
    expect(planSoothTrade).toHaveBeenCalledTimes(2);
    expect(planSoothTrade).toHaveBeenLastCalledWith(resolved, account, props.initialIntent);
    expect(sendSoothAction).toHaveBeenCalledTimes(1);
    expect(sendSoothAction).toHaveBeenCalledWith(resolved, expect.objectContaining({ sendTransaction: expect.any(Function) }), account,
      reviewed.action, expect.any(Function));
  });

  it('does not request a quote for shares the trade planner would reject', () => {
    const { ui } = renderMarket();
    fireEvent.change(ui.getByRole('textbox', { name: 'Shares' }), { target: { value: '1.2.3' } });
    expect(useSoothLiveQuote).toHaveBeenLastCalledWith(resolved, null);
    expect(ui.queryByRole('region', { name: 'Live quote' })).toBeNull();
  });

  it.each([
    { priceImpact: 0.019, level: 'none' },
    { priceImpact: 0.021, level: 'warn' },
    { priceImpact: 0.05, level: 'warn' },
    { priceImpact: 0.051, level: 'high' },
    { priceImpact: -0.06, level: 'high' },
  ])('warns for a $priceImpact price impact at level $level', ({ priceImpact, level }) => {
    vi.mocked(useSoothLiveQuote).mockReturnValue({ ...idle(), data: liveQuote({ priceImpact }) });
    const { ui } = renderMarket();
    const warn = ui.queryByText('Price impact above 2%. Consider trading in smaller sizes.');
    const high = ui.queryByText('High impact! Price moves more than 5% on this trade.');
    expect(warn !== null).toBe(level === 'warn');
    expect(high !== null).toBe(level === 'high');
    if (level === 'high') expect(high!.closest('[role="alert"]')).not.toBeNull();
  });
});

describe('SoothMarket sell presets', () => {
  it('sets MAX to the owned AMM shares of the selected outcome and offers it only for sells', async () => {
    data.account!.positions!.positions[0] = { ...data.account!.positions!.positions[0]!, yes: 12_500_000_000_000_000_000n, no: 3n * 10n ** 18n };
    vi.mocked(planSoothTrade).mockResolvedValue(preview(5_000_000n));
    const { ui } = renderMarket();
    expect(ui.queryByRole('button', { name: 'Max' })).toBeNull();
    await click(ui.getByRole('radio', { name: 'Sell' }));
    await click(ui.getByRole('button', { name: 'Max' }));
    expect((ui.getByRole('textbox', { name: 'Shares' }) as HTMLInputElement).value).toBe('12.5');
    await click(ui.getByRole('radio', { name: 'NO' }));
    await click(ui.getByRole('button', { name: 'Max' }));
    expect((ui.getByRole('textbox', { name: 'Shares' }) as HTMLInputElement).value).toBe('3');
    await click(ui.getByRole('button', { name: 'Review sell' }));
    expect(planSoothTrade).toHaveBeenCalledWith(resolved, account, { side: 'sell', outcome: 0, shares: '3', price: '50' });
  });

  it('limits book MAX to unreserved whole share units', async () => {
    const book = bookData();
    book.account!.inventory = { ...book.account!.inventory!, yesOwned: 30_500_000_000_000_000_000n, yesReserved: 10n ** 19n };
    marketState = { ...marketState, resolved: bookMarket, data: book };
    const { ui } = renderMarket(bookMarket.reference);
    await click(ui.getByRole('radio', { name: 'Sell' }));
    await click(ui.getByRole('button', { name: 'Max' }));
    expect((ui.getByRole('textbox', { name: 'Shares' }) as HTMLInputElement).value).toBe('20');
  });
});

describe('SoothMarket open orders', () => {
  it('shows partial order discovery as an error, never as an empty list', async () => {
    marketState = { ...marketState, resolved: bookMarket, data: bookData({ ordersError: 'log range too large' }) };
    const { ui } = renderMarket(bookMarket.reference);
    await click(ui.getByRole('tab', { name: 'Orders' }));
    expect(alertText(ui)).toContain('Open-order discovery is incomplete: log range too large');
    expect(ui.queryByText('No open orders.')).toBeNull();
    await click(ui.getByRole('button', { name: 'Retry orders' }));
    expect(marketState.refresh).toHaveBeenCalledOnce();
  });

  it('lists open orders at their outcome price and cancels exactly the selected order', async () => {
    const order = {
      orderId: 7n, market: resolved.reference.market, maker: account, action: 0, outcome: 0,
      yesTick: 400, amount: 5n * 10n ** 18n, expiry: 1_900_000_000n, cashReserved: 3_000_000n,
    };
    marketState = {
      ...marketState, resolved: bookMarket,
      data: bookData({ orders: { blockNumber: 10n, orders: [order], complete: true } }),
    };
    const { ui } = renderMarket(bookMarket.reference);
    await click(ui.getByRole('tab', { name: 'Orders (1)' }));
    expect(ui.getByText('60.0¢')).toBeTruthy();
    await click(ui.getByRole('button', { name: 'Cancel order #7' }));
    expect(sendSoothAction).toHaveBeenCalledWith(bookMarket, expect.objectContaining({ sendTransaction: expect.any(Function) }), account, {
      kind: 'cancelOrder', orderId: 7n,
    }, expect.any(Function));
  });
});

describe('SoothMarket liquidity deposits', () => {
  const lpToken = { address: address(7), decimals: 6, symbol: 'LPT' };
  function liquidity(): SoothLiquidity {
    return {
      blockNumber: 10n, token: lpToken, liquidityOpen: true, settled: false, receipts: [], claims: [],
      entitlements: {} as SoothLiquidity['entitlements'],
    };
  }
  function lpPreview(approveNative: bigint | null, allowance = 0n): SoothLiquidityPreview {
    return {
      action: {
        kind: 'increaseLiquidity', additionalB: 10n ** 20n,
        limits: { maxTokenIn: 25_000_000n } as SoothLiquidityPreview['action']['limits'],
      },
      approveNative, approvalVenue: 'amm', allowance, requiredNative: 25_000_000n,
      quotedNative: 24_900_000n, receiptUnits: 10n ** 20n, feeBps: 0, data,
      description: 'Add 24.9 LPT of AMM liquidity at the current price.',
    };
  }
  async function openDeposit(ui: BoundFunctions<typeof queries>) {
    await click(ui.getByRole('tab', { name: 'Liquidity' }));
    fireEvent.change(ui.getByRole('textbox', { name: 'Deposit amount' }), { target: { value: '25' } });
    await click(ui.getByRole('button', { name: 'Review deposit' }));
    expect(planSoothAddLiquidity).toHaveBeenLastCalledWith(bookMarket, account, 25_000_000n);
  }

  it.each([
    { allowance: 0n, button: 'Approve unlimited LPT', amount: (1n << 256n) - 1n },
    { allowance: 0n, button: 'Approve exact amount', amount: 25_000_000n },
    { allowance: 1_000_000n, button: 'Reset allowance to zero', amount: 0n },
  ])('approves the AMM spender from a book market: $button', async ({ allowance, button, amount }) => {
    vi.mocked(useSoothLiquidity).mockReturnValue({ ...idle(), data: liquidity() });
    vi.mocked(planSoothAddLiquidity).mockResolvedValue(lpPreview(25_000_000n, allowance));
    marketState = { ...marketState, resolved: bookMarket, data: bookData() };
    const { ui } = renderMarket(bookMarket.reference);
    await openDeposit(ui);
    expect(ui.getByText(/This deposit needs 25 LPT approved for the verified AMM spender/)).toBeTruthy();
    expect(sendSoothAction).not.toHaveBeenCalled();

    await click(ui.getByRole('button', { name: button }));
    expect(planSoothAddLiquidity).toHaveBeenCalledTimes(2);
    expect(sendSoothAction).toHaveBeenCalledTimes(1);
    expect(sendSoothAction).toHaveBeenCalledWith(bookMarket, expect.objectContaining({ sendTransaction: expect.any(Function) }), account, {
      kind: 'approve', venue: 'amm', amountNative: amount,
    }, expect.any(Function));
  });

  it('requires reconfirmation when the re-planned approval changes', async () => {
    vi.mocked(useSoothLiquidity).mockReturnValue({ ...idle(), data: liquidity() });
    vi.mocked(planSoothAddLiquidity)
      .mockResolvedValueOnce(lpPreview(25_000_000n))
      .mockResolvedValueOnce(lpPreview(25_000_000n, 1_000_000n));
    marketState = { ...marketState, resolved: bookMarket, data: bookData() };
    const { ui } = renderMarket(bookMarket.reference);
    await openDeposit(ui);
    await click(ui.getByRole('button', { name: 'Approve exact amount' }));
    expect(sendSoothAction).not.toHaveBeenCalled();
    expect(alertText(ui)).toBe(changedMessage);
    expect(ui.getByRole('button', { name: 'Reset allowance to zero' })).toBeTruthy();
  });

  it('signs the re-planned deposit only when it matches the review', async () => {
    vi.mocked(useSoothLiquidity).mockReturnValue({ ...idle(), data: liquidity() });
    const reviewed = lpPreview(null);
    const moved = { ...lpPreview(null), quotedNative: 24_950_000n };
    vi.mocked(planSoothAddLiquidity)
      .mockResolvedValueOnce(reviewed)
      .mockResolvedValueOnce(moved)
      .mockResolvedValueOnce(moved);
    marketState = { ...marketState, resolved: bookMarket, data: bookData() };
    const { ui } = renderMarket(bookMarket.reference);
    await openDeposit(ui);
    await click(ui.getByRole('button', { name: 'Confirm deposit' }));
    expect(sendSoothAction).not.toHaveBeenCalled();
    expect(alertText(ui)).toBe('The quote changed. Review the updated bounds and confirm again.');

    await click(ui.getByRole('button', { name: 'Confirm deposit' }));
    expect(planSoothAddLiquidity).toHaveBeenCalledTimes(3);
    expect(sendSoothAction).toHaveBeenCalledTimes(1);
    expect(sendSoothAction).toHaveBeenCalledWith(bookMarket, expect.objectContaining({ sendTransaction: expect.any(Function) }), account,
      moved.action, expect.any(Function));
  });
});
