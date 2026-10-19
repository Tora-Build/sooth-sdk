import { describe, expect, it } from 'vitest';
import { interpolate, soothText } from '../../../src/react/ui/i18n.js';

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('ui i18n', () => {
  it('zh covers every en key with non-empty text and the same placeholders', () => {
    const en = soothText('en').table;
    const zh = soothText('zh').table;
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort());
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(zh[key].trim(), key).not.toBe('');
      expect(placeholders(zh[key]), key).toEqual(placeholders(en[key]));
    }
  });

  it('interpolates variables and leaves unknown placeholders visible', () => {
    expect(soothText('en').t('trade.buyOutcome', { outcome: 'YES' })).toBe('Buy YES');
    expect(soothText('zh').t('node.marketCount', { count: 3 })).toBe('3 个市场');
    expect(interpolate('{a} and {b}', { a: 1 })).toBe('1 and {b}');
    expect(interpolate('{toString}', {})).toBe('{toString}');
  });

  it('falls back to English for unsupported locales', () => {
    const strings = soothText('fr' as 'en');
    expect(strings.locale).toBe('en');
    expect(strings.t('common.buy')).toBe('Buy');
  });
});
