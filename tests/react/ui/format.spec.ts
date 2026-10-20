import { describe, expect, it } from 'vitest';
import {
  countdownTo,
  formatBps,
  formatCents,
  formatCompact,
  formatCountdown,
  formatPercent,
  formatProbability,
  formatProbabilityChange,
  formatShares,
  formatTokenAmount,
  shortAddress,
} from '../../../src/react/ui/format.js';

describe('ui format', () => {
  it('truncates token amounts instead of rounding and groups digits', () => {
    expect(formatTokenAmount(1_999_999n, 6)).toBe('1.99');
    expect(formatTokenAmount(1_234_567_890_000n, 6, 0)).toBe('1,234,567');
    expect(formatTokenAmount(1_234_567_890_000n, 6, 2, { group: false })).toBe('1234567.89');
    expect(formatTokenAmount(5n, 0, 2)).toBe('5');
  });

  it('does not show a negative sign for amounts that truncate to zero', () => {
    expect(formatTokenAmount(-1n, 6)).toBe('0.00');
    expect(formatTokenAmount(-1_500_000n, 6)).toBe('-1.50');
  });

  it('formats WAD shares', () => {
    expect(formatShares(12_345_678_900_000_000_000n)).toBe('12.34');
  });

  it('formats prices, percents and bps with unavailable fallbacks', () => {
    expect(formatCents(0.625)).toBe('62.5¢');
    expect(formatPercent(0.0123, 2)).toBe('1.23%');
    expect(formatBps(150)).toBe('1.5%');
    expect(formatBps(100n)).toBe('1%');
    expect(formatCents(null)).toBe('—');
    expect(formatPercent(Number.NaN)).toBe('—');
  });

  it('keeps uncertain probabilities off 0% and 100%', () => {
    expect(formatProbability(0.004)).toBe('<1%');
    expect(formatProbability(0.996)).toBe('>99%');
    expect(formatProbability(0)).toBe('0%');
    expect(formatProbability(1)).toBe('100%');
    expect(formatProbability(0.505)).toBe('51%');
    expect(formatProbabilityChange(0.5, 0.532)).toBe('+3.2 pts');
    expect(formatProbabilityChange(0.5, 0.45)).toBe('−5.0 pts');
  });

  it('compacts large amounts per locale', () => {
    expect(formatCompact(12_345, 'en', '$')).toBe('$12.3K');
    expect(formatCompact(12_345, 'zh')).toBe('1.2万');
    expect(formatCompact(-42.5)).toBe('-42.50');
  });

  it('shortens addresses', () => {
    expect(shortAddress('0x1234567890abcdef1234567890abcdef12345678')).toBe('0x1234…5678');
    expect(shortAddress('0x12')).toBe('0x12');
    expect(shortAddress(undefined)).toBe('—');
  });

  it('counts down to a deadline and stops at zero', () => {
    const now = 1_700_000_000_000;
    const deadline = BigInt(now / 1000 + 3 * 86_400 + 4 * 3_600 + 5 * 60);
    expect(countdownTo(deadline, now)).toMatchObject({ days: 3, hours: 4, minutes: 5, expired: false });
    expect(formatCountdown(deadline, 'en', now)).toBe('3d 4h');
    expect(formatCountdown(deadline, 'zh', now)).toBe('3天 4小时');
    expect(formatCountdown(now / 1000 + 30, 'en', now)).toBe('1m');
    expect(formatCountdown(now / 1000 - 1, 'en', now)).toBe('');
    expect(countdownTo(now / 1000 - 1, now).expired).toBe(true);
  });
});
