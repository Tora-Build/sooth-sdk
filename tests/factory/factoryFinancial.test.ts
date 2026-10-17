import { describe, expect, it } from 'vitest';
import { planAmmTrade, planBookOrder, planTokenApproval, bookOrderCrosses, type AmmTradeInput, type BookOrderInput } from '../../src/factory/factoryTrade.js';

const token = { address: '0x0000000000000000000000000000000000000001' as const, decimals: 6, symbol: 'USD' };
const amm: AmmTradeInput = { side: 'buy', outcome: 1, sharesWad: 10n ** 18n, quote: { costWad: 1_000_000_000_000n, feeWad: 1n, netWad: 1_000_000_000_001n, newPriceWad: 5n * 10n ** 17n }, token, balance: 10n, allowance: 0n, held: { yes: 10n ** 18n, no: 0n }, slippageBps: 0n };
const book: BookOrderInput = { action: 0, outcome: 0, priceTick: 333, sharesWad: 3n * 10n ** 12n, shareUnit: 10n ** 12n, feeBps: 20, token, balance: 10n, allowance: 0n, inventory: { yesOwned: 0n, noOwned: 0n, yesReserved: 0n, noReserved: 0n }, postOnly: false };

describe('Factory financial plans against native rounding and contract domains', () => {
  it('requires the extra native unit for a one-WAD-wei buy remainder', () => {
    expect(planAmmTrade(amm)).toMatchObject({ ok: true, boundWad: 1_000_000_000_001n, requiredNative: 2n, approveNative: 2n });
    expect(planAmmTrade({ ...amm, balance: 1n })).toMatchObject({ ok: false, shortfall: true });
    expect(planAmmTrade({ ...amm, allowance: 2n })).toMatchObject({ ok: true, approveNative: null });
  });
  it('allows authorization without collateral while trade plans still reject the shortfall', () => {
    expect(planAmmTrade({ ...amm, balance: 0n, approvalOnly: true })).toMatchObject({ ok: true, requiredNative: 2n, approveNative: 2n });
    expect(planAmmTrade({ ...amm, balance: 0n })).toMatchObject({ ok: false, shortfall: true });
    expect(planBookOrder({ ...book, balance: 0n, approvalOnly: true })).toMatchObject({ ok: true, maxTokenIn: 3n, approveNative: 3n });
    expect(planBookOrder({ ...book, balance: 0n })).toMatchObject({ ok: false, shortfall: true });
    expect(planAmmTrade({ ...amm, balance: 0n, approvalOnly: true, approvalLimitNative: 1n })).toMatchObject({ ok: false });
    expect(planBookOrder({ ...book, balance: 0n, approvalOnly: true, approvalLimitNative: 1n })).toMatchObject({ ok: false });
  });
  it('reuses surplus allowance when the AMM quote decreases and requires approval when it increases past the allowance', () => {
    expect(planAmmTrade({ ...amm, allowance: 3n })).toMatchObject({ ok: true, approveNative: null });
    expect(planAmmTrade({ ...amm, allowance: 3n, quote: { ...amm.quote!, netWad: 1n } })).toMatchObject({ ok: true, requiredNative: 1n, approveNative: null });
    expect(planAmmTrade({ ...amm, allowance: 3n, quote: { ...amm.quote!, netWad: 3_000_000_000_001n } })).toMatchObject({ ok: true, requiredNative: 4n, approveNative: 4n });
  });
  it('approves an explicit finite AMM budget without widening the transaction bound', () => {
    expect(planAmmTrade({ ...amm, approvalLimitNative: 100n })).toMatchObject({ ok: true, boundWad: 1_000_000_000_001n, requiredNative: 2n, approveNative: 100n });
    expect(planAmmTrade({ ...amm, allowance: 3n, approvalLimitNative: 100n })).toMatchObject({ ok: true, approveNative: null });
    expect(planAmmTrade({ ...amm, allowance: 3n, approvalLimitNative: 1n })).toMatchObject({ ok: false });
  });
  it('uses net quote once, rounds buy slippage up and sell slippage down', () => {
    const quote = { costWad: 90n, feeWad: 11n, netWad: 101n, newPriceWad: 0n };
    expect(planAmmTrade({ ...amm, quote, slippageBps: 100n })).toMatchObject({ ok: true, boundWad: 103n });
    expect(planAmmTrade({ ...amm, side: 'sell', quote, slippageBps: 100n })).toMatchObject({ ok: true, boundWad: 99n, deltaShares: -(10n ** 18n), requiredNative: 0n, approveNative: null });
    expect(planAmmTrade({ ...amm, side: 'sell', outcome: 0 })).toMatchObject({ ok: false });
  });
  it('refuses missing quotes and negative or excessive slippage', () => {
    expect(planAmmTrade({ ...amm, quote: null })).toMatchObject({ ok: false });
    for (const slippageBps of [-1n, 10_001n]) expect(planAmmTrade({ ...amm, slippageBps })).toMatchObject({ ok: false });
  });
  it('bounds native cash and taker fee for sub-token BUY NO shares', () => {
    expect(planBookOrder(book)).toMatchObject({ ok: true, cashNative: 1n, maxTokenIn: 3n, approveNative: 3n });
    expect(planBookOrder({ ...book, balance: 2n })).toMatchObject({ ok: false, shortfall: true });
    expect(planBookOrder({ ...book, sharesWad: book.sharesWad + 1n })).toMatchObject({ ok: false });
    expect(planBookOrder({ ...book, sharesWad: 1n << 128n, shareUnit: 1n })).toMatchObject({ ok: false });
  });
  it('reuses surplus book allowance and keeps a custom grant separate from the fee bound', () => {
    expect(planBookOrder({ ...book, allowance: 4n })).toMatchObject({ ok: true, maxTokenIn: 3n, approveNative: null });
    expect(planBookOrder({ ...book, approvalLimitNative: 100n })).toMatchObject({ ok: true, maxTokenIn: 3n, approveNative: 100n });
    expect(planBookOrder({ ...book, allowance: 4n, approvalLimitNative: 100n })).toMatchObject({ ok: true, maxTokenIn: 3n, approveNative: null });
    expect(planBookOrder({ ...book, allowance: 4n, approvalLimitNative: 2n })).toMatchObject({ ok: false });
  });
  it('normalizes all four order directions at the crossing boundary', () => {
    for (const [action, outcome, priceTick, bestBidTick, bestAskTick] of [
      [0, 1, 400, undefined, 400], [1, 0, 600, undefined, 400],
      [0, 0, 600, 400, undefined], [1, 1, 400, 400, undefined],
    ] as const) expect(bookOrderCrosses({ action, outcome, priceTick, bestBidTick, bestAskTick })).toBe(true);
    expect(planBookOrder({ ...book, postOnly: true, bestBidTick: 667 })).toMatchObject({ ok: false });
    expect(planBookOrder({ ...book, action: 1, inventory: { ...book.inventory, noOwned: book.sharesWad, noReserved: 1n } })).toMatchObject({ ok: false });
  });
});

describe('finite reusable token approval policy', () => {
  it('uses exact default and never downsizes an existing grant', () => {
    expect(planTokenApproval({ allowance: 0n, requiredNative: 10n })).toEqual({ ok: true, approveNative: 10n });
    for (const allowance of [10n, 11n, (1n << 256n) - 1n]) expect(planTokenApproval({ allowance, requiredNative: 10n })).toEqual({ ok: true, approveNative: null });
    expect(planTokenApproval({ allowance: 0n, requiredNative: 0n })).toEqual({ ok: true, approveNative: null });
  });
  it('rejects invalid or too-small custom limits even with sufficient allowance', () => {
    for (const approvalLimitNative of [-1n, 0n, 9n, (1n << 256n) - 1n, 1n << 256n]) {
      expect(planTokenApproval({ allowance: 100n, requiredNative: 10n, approvalLimitNative })).toMatchObject({ ok: false });
    }
  });
  it('checks the fresh required amount against the chosen grant before acceptance', () => {
    expect(planTokenApproval({ allowance: 0n, requiredNative: 10n, approvalLimitNative: 20n })).toEqual({ ok: true, approveNative: 20n });
    expect(planTokenApproval({ allowance: 20n, requiredNative: 19n, approvalLimitNative: 20n })).toEqual({ ok: true, approveNative: null });
    expect(planTokenApproval({ allowance: 20n, requiredNative: 21n, approvalLimitNative: 20n })).toMatchObject({ ok: false });
  });
});
