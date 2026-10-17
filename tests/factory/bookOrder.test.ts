import { describe, expect, it } from 'vitest';
import {
  BOOK_BUY,
  BOOK_SELL,
  bookBuyCashNative,
  bookBuyMaxTokenIn,
  bookOrderCrosses,
  centsToTick,
  setsCollateralNative,
  tickToCents,
  yesAxisTick,
} from '../../src/factory/factoryTrade/bookOrder.js';

const WAD = 10n ** 18n;

describe('book order arithmetic', () => {
  it('reads cents as ticks and back', () => {
    expect(centsToTick('50')).toBe(500);
    expect(centsToTick('0.1')).toBe(1);
    expect(centsToTick('99.9')).toBe(999);
    expect(centsToTick('0')).toBeNull();
    expect(centsToTick('100')).toBeNull();
    expect(centsToTick('12.34')).toBeNull();
    expect(centsToTick('abc')).toBeNull();
    expect(tickToCents(455)).toBe('45.5¢');
    expect(yesAxisTick(0, 600)).toBe(400);
    expect(yesAxisTick(1, 600)).toBe(600);
  });

  it('reserves the limit price and bounds the fee, rounding up', () => {
    expect(bookBuyCashNative(400, 5n * WAD, 1n)).toBe(2n * WAD);
    expect(bookBuyCashNative(333, 1n, 1n)).toBe(1n);
    // Six-decimal collateral (shareUnit 1e12): 5 shares at 40 cents is 2.000000.
    expect(bookBuyCashNative(400, 5n * WAD, 10n ** 12n)).toBe(2_000_000n);
    expect(bookBuyMaxTokenIn(400, 5n * WAD, 1n, 100)).toBe(2n * WAD + (2n * WAD) / 100n + 1n);
    // A NO buy at 60¢ pays 0.6 per NO share: the price is the outcome's own.
    expect(bookBuyCashNative(600, WAD, 10n ** 12n)).toBe(600_000n);
  });

  it('prices a complete set at one unit of collateral, or refuses the amount', () => {
    expect(setsCollateralNative(3n * WAD, 1n)).toBe(3n * WAD);
    expect(setsCollateralNative((5n * WAD) / 2n, 10n ** 12n)).toBe(2_500_000n);
    expect(setsCollateralNative(10n ** 11n, 10n ** 12n)).toBeUndefined();
    expect(setsCollateralNative(0n, 1n)).toBeUndefined();
    expect(setsCollateralNative(1n << 128n, 1n)).toBeUndefined();
  });

  it('knows which orders would trade on arrival', () => {
    const book = { bestBidTick: 400, bestAskTick: 450 };
    expect(bookOrderCrosses({ action: BOOK_BUY, outcome: 1, priceTick: 450, ...book })).toBe(true);
    expect(bookOrderCrosses({ action: BOOK_BUY, outcome: 1, priceTick: 449, ...book })).toBe(false);
    expect(bookOrderCrosses({ action: BOOK_SELL, outcome: 1, priceTick: 400, ...book })).toBe(true);
    expect(bookOrderCrosses({ action: BOOK_SELL, outcome: 1, priceTick: 401, ...book })).toBe(false);
    // BUY NO at 60¢ is an ask at YES 400: it crosses the best bid 400. At 59.9¢ (YES 401) it rests.
    expect(bookOrderCrosses({ action: BOOK_BUY, outcome: 0, priceTick: 600, ...book })).toBe(true);
    expect(bookOrderCrosses({ action: BOOK_BUY, outcome: 0, priceTick: 599, ...book })).toBe(false);
    // SELL NO at 55¢ is a bid at YES 450: it crosses the best ask 450.
    expect(bookOrderCrosses({ action: BOOK_SELL, outcome: 0, priceTick: 550, ...book })).toBe(true);
    expect(bookOrderCrosses({ action: BOOK_BUY, outcome: 1, priceTick: 999, bestBidTick: 400 })).toBe(false);
  });
});
