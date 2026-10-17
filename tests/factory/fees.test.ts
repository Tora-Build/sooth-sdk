import { describe, expect, it } from 'vitest';
import { allocateAmmFee, allocateBookFee, reconstructAmmBaseCost } from '../../src/factory/factoryTrade/fees.js';
import { wadToNativeCeil, wadToNativeFloor } from '../../src/factory/factoryTrade/amounts.js';

const W = 10n ** 18n;
const config = { feeBps: 100, capitalBps: 5000, lpBps: 3000, resolutionBps: 1000, operatorBps: 1000 };

describe('Factory fee arithmetic', () => {
  it('allocates 100 fee tokens as 50 capital, 30 LP, 10 resolution and 10 operator', () => {
    expect(allocateAmmFee(10000n * W, config, 6)).toEqual({
      feeWad: 100n * W, capitalWad: 50n * W, revenueNative: 50000000n,
      lpNative: 30000000n, resolutionNative: 10000000n, operatorNative: 10000000n, remainderWad: 0n,
    });
  });
  it('floors native AMM revenue and sends all split dust only to OPERATOR', () => {
    const c = { feeBps: 10000, capitalBps: 0, lpBps: 5000, resolutionBps: 5000, operatorBps: 0 };
    const f = allocateAmmFee(1999999999999n, c, 6);
    expect(f.revenueNative).toBe(1n);
    expect(f.lpNative).toBe(0n);
    expect(f.resolutionNative).toBe(0n);
    expect(f.operatorNative).toBe(1n);
    expect(f.remainderWad).toBe(999999999999n);
  });
  it('handles full CAPITAL and zero rates without division or invented LP fees', () => {
    const full = { ...config, capitalBps: 10000, lpBps: 0, resolutionBps: 0, operatorBps: 0 };
    expect(allocateAmmFee(100n * W, full, 18).revenueNative).toBe(0n);
    expect(allocateAmmFee(100n * W, { ...config, feeBps: 0 }, 18).feeWad).toBe(0n);
  });
  it('uses book complementary-price basis, aggregate ceiling and protocol dust', () => {
    // Two fills each with 0.4 native units of exact fee: aggregate ceil=1, not 2.
    expect(allocateBookFee(800000000000n, 10000, 5000, 6)).toEqual({ feeNative: 1n, resolutionNative: 0n, protocolNative: 1n });
    expect(allocateBookFee(20n * W, 20, 3000, 6)).toEqual({ feeNative: 40000n, resolutionNative: 12000n, protocolNative: 28000n });
  });
  it('rounds TO up and FROM down at 6 decimals, while 18 decimals are exact', () => {
    expect(wadToNativeCeil(1000000000001n, 6)).toBe(2n);
    expect(wadToNativeFloor(1000000000001n, 6)).toBe(1n);
    expect(wadToNativeCeil(1000000000001n, 18)).toBe(1000000000001n);
    expect(wadToNativeCeil(0n, 6)).toBe(0n);
  });
  it('reconstructs real AMM trade bases from fee-inclusive buys and net sells', () => {
    expect(reconstructAmmBaseCost(507524957917788859n, 'buy', 100)).toBe(502499958334444415n);
    expect(reconstructAmmBaseCost(497474958751099963n, 'sell', 100)).toBe(502499958334444407n);
  });
});
