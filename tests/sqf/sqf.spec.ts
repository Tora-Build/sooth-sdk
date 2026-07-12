import { describe, expect, it } from 'vitest';
import {
  extractQuestion,
  generateSQF,
  parseSQF,
  parseSQFSafe,
  type SQFData,
} from '../../src/lib/sqf';

// Behavior consolidated from the three per-app parser copies (demo's was the
// fullest and is now canonical here). The apps import this module — any
// change to these semantics changes what every Sooth surface renders.

const RAW = [
  '§question',
  'Will BTC close above $100,000 on Dec 31, 2026?',
  '§rule',
  'Resolves YES if the CoinGecko daily close is above $100,000.',
  'source:coingecko-btc',
  'op:>',
  'value:100000',
  '§event',
  'BTC-MILESTONES-2026',
  '§category',
  'crypto',
  '§meta',
  'icon:btc',
].join('\n');

describe('parseSQF', () => {
  it('parses question, rule kv pairs + description, event, category, meta', () => {
    const parsed = parseSQF(RAW);
    expect(parsed.question).toBe('Will BTC close above $100,000 on Dec 31, 2026?');
    expect(parsed.rule.description).toBe(
      'Resolves YES if the CoinGecko daily close is above $100,000.',
    );
    expect(parsed.rule.source).toBe('coingecko-btc');
    expect(parsed.rule.op).toBe('>');
    expect(parsed.rule.value).toBe('100000');
    expect(parsed.event).toBe('BTC-MILESTONES-2026');
    expect(parsed.category).toBe('crypto');
    expect(parsed.meta).toEqual({ icon: 'btc' });
  });

  it('keeps rule lines containing URLs in the description, not as kv pairs', () => {
    const parsed = parseSQF('§question\nQ?\n§rule\nhttp://example.com/a:b\nsource:x');
    expect(parsed.rule.description).toBe('http://example.com/a:b');
    expect(parsed.rule.source).toBe('x');
  });

  it('joins multi-line questions with spaces', () => {
    const parsed = parseSQF('§question\nline one\nline two');
    expect(parsed.question).toBe('line one line two');
  });
});

describe('generateSQF ⇄ parseSQF round-trip', () => {
  it('survives a full round-trip', () => {
    const data: SQFData = {
      question: 'Will X happen?',
      rule: { description: 'Resolves YES if X.', source: 'flux-kpi-api', op: 'eq' },
      event: 'EV-1',
      category: 'tech',
      meta: { icon: 'x' },
    };
    expect(parseSQF(generateSQF(data))).toEqual(data);
  });
});

describe('extractQuestion / parseSQFSafe', () => {
  it('extracts the question from SQF strings', () => {
    expect(extractQuestion(RAW)).toBe('Will BTC close above $100,000 on Dec 31, 2026?');
  });

  it('passes plain (non-SQF) strings through untouched', () => {
    expect(extractQuestion('Just a plain question?')).toBe('Just a plain question?');
    expect(parseSQFSafe('Just a plain question?')).toEqual({
      question: 'Just a plain question?',
      rule: {},
    });
  });
});
