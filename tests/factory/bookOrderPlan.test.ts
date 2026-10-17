import { describe, expect, it } from 'vitest';
import { BOOK_BUY, BOOK_SELL, bookBuyMaxTokenIn } from '../../src/factory/factoryTrade/bookOrder.js';
import { planBookOrder, type BookOrderInput } from '../../src/factory/factoryTrade/bookOrderPlan.js';

const WAD = 10n ** 18n;
const UNIT = 10n ** 12n; // a six-decimal book token
const wrmb = { address: '0x4444444444444444444444444444444444444444', decimals: 6, symbol: 'WRMB' } as const;
const empty = { yesOwned: 0n, noOwned: 0n, yesReserved: 0n, noReserved: 0n };
const base: BookOrderInput = {
  action: BOOK_BUY,
  outcome: 1,
  priceTick: 400,
  sharesWad: 5n * WAD,
  shareUnit: UNIT,
  feeBps: 100,
  token: wrmb,
  balance: 10_000_000n,
  allowance: 0n,
  inventory: empty,
  bestBidTick: 390,
  bestAskTick: 450,
  postOnly: false,
};

describe('planBookOrder', () => {
  it('buy: reserves the limit price, approves exactly the cash plus the fee bound', () => {
    const plan = planBookOrder(base);
    const maxTokenIn = bookBuyMaxTokenIn(400, 5n * WAD, UNIT, 100);
    expect(plan).toEqual({ ok: true, cashNative: 2_000_000n, maxTokenIn, approveNative: maxTokenIn, crosses: false });
    expect(maxTokenIn).toBe(2_000_000n + 20_000n + 1n);
    expect(planBookOrder({ ...base, allowance: maxTokenIn })).toMatchObject({ ok: true, approveNative: null });
    expect(planBookOrder({ ...base, allowance: maxTokenIn + 1n })).toMatchObject({ ok: true, approveNative: null });
  });

  it('uses a finite reusable allowance without changing the order spend bound', () => {
    const maxTokenIn = bookBuyMaxTokenIn(400, 5n * WAD, UNIT, 100);
    const approvalLimitNative = 20_000_000n;
    expect(planBookOrder({ ...base, approvalLimitNative })).toMatchObject({ ok: true, maxTokenIn, approveNative: approvalLimitNative });
    expect(planBookOrder({ ...base, allowance: maxTokenIn, approvalLimitNative })).toMatchObject({ ok: true, maxTokenIn, approveNative: null });
    expect(planBookOrder({ ...base, allowance: maxTokenIn, approvalLimitNative: maxTokenIn - 1n })).toMatchObject({ ok: false });
    expect(planBookOrder({ ...base, approvalLimitNative: (1n << 256n) - 1n })).toMatchObject({ ok: false });
  });

  it('buy: refuses a short balance with the token named and a funding flag', () => {
    const plan = planBookOrder({ ...base, balance: 1_000_000n });
    expect(plan).toEqual({ ok: false, reason: expect.any(String), shortfall: true });
  });

  it('plans scheduled approval without funds, while keeping trade funding and approval-limit checks', () => {
    const maxTokenIn = bookBuyMaxTokenIn(400, 5n * WAD, UNIT, 100);
    expect(planBookOrder({ ...base, balance: 0n, approvalOnly: true })).toMatchObject({ ok: true, maxTokenIn, approveNative: maxTokenIn });
    expect(planBookOrder({ ...base, balance: 0n, approvalOnly: true, approvalLimitNative: 20_000_000n })).toMatchObject({ ok: true, maxTokenIn, approveNative: 20_000_000n });
    expect(planBookOrder({ ...base, balance: 0n, approvalOnly: true, allowance: maxTokenIn })).toMatchObject({ ok: true, approveNative: null });
    expect(planBookOrder({ ...base, balance: 0n, approvalOnly: true, approvalLimitNative: maxTokenIn - 1n })).toMatchObject({ ok: false });
    expect(planBookOrder({ ...base, balance: 0n, approvalOnly: false })).toMatchObject({ ok: false, shortfall: true });
  });

  it('refuses a price that is not a price, zero shares, and shares off the share unit', () => {
    expect(planBookOrder({ ...base, priceTick: null })).toMatchObject({ ok: false, reason: expect.any(String) });
    expect(planBookOrder({ ...base, sharesWad: 0n })).toMatchObject({ ok: false, reason: expect.any(String) });
    expect(planBookOrder({ ...base, sharesWad: 5n * WAD + 1n })).toMatchObject({ ok: false, reason: expect.any(String) });
  });

  it('sell: no approval, only free inventory of that outcome', () => {
    const inventory = { yesOwned: 3n * WAD, noOwned: 0n, yesReserved: WAD, noReserved: 0n };
    expect(planBookOrder({ ...base, action: BOOK_SELL, sharesWad: 2n * WAD, inventory, priceTick: 500 }))
      .toEqual({ ok: true, cashNative: 0n, maxTokenIn: 0n, approveNative: null, crosses: false });
    expect(planBookOrder({ ...base, action: BOOK_SELL, sharesWad: 3n * WAD, inventory, priceTick: 500 }))
      .toMatchObject({ ok: false, reason: expect.any(String) });
    expect(planBookOrder({ ...base, action: BOOK_SELL, outcome: 0, sharesWad: WAD, inventory, priceTick: 500 }))
      .toMatchObject({ ok: false, reason: expect.any(String) });
  });

  it('marks an order that would trade on arrival, and refuses it when post-only', () => {
    const crossing = planBookOrder({ ...base, priceTick: 450 });
    expect(crossing).toMatchObject({ ok: true, crosses: true });
    expect(planBookOrder({ ...base, priceTick: 450, postOnly: true })).toMatchObject({ ok: false, reason: expect.any(String) });
    // BUY NO at 60¢ is an ask at YES 400: it crosses a bid at 400, not one at 390.
    expect(planBookOrder({ ...base, outcome: 0, priceTick: 600 })).toMatchObject({ ok: true, crosses: false });
    expect(planBookOrder({ ...base, outcome: 0, priceTick: 610 })).toMatchObject({ ok: true, crosses: true });
  });

  it('buy: not planned without the fee', () => {
    expect(planBookOrder({ ...base, feeBps: null })).toMatchObject({ ok: false, reason: expect.any(String) });
    expect(planBookOrder({ ...base, action: BOOK_SELL, feeBps: null, inventory: { ...empty, yesOwned: 5n * WAD } })).toMatchObject({ ok: true });
  });
});
