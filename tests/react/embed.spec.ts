import { describe, expect, it } from 'vitest';
import { acceptsSoothEmbedMessage, formatSoothMarketReference, parseSoothMarketReference, renderSoothEmbedSnippet, soothWidgetUrl, SOOTH_EMBED_PROTOCOL, type SoothMarketReference } from '../../src/react/embed.js';
const market: SoothMarketReference = { chainId: 46630, factory: `0x${'11'.repeat(20)}`, nodeId: `0x${'22'.repeat(32)}`, market: `0x${'33'.repeat(20)}`, releaseId: `0x${'44'.repeat(32)}`, venue: 'book' };
const reference = formatSoothMarketReference(market);
describe('Sooth embed identity and trust boundary', () => {
  it('round trips full identity and keeps venue and release distinct', () => {
    expect(parseSoothMarketReference(reference)).toEqual(market);
    expect(formatSoothMarketReference({ ...market, venue: 'amm' })).not.toBe(reference);
    expect(() => parseSoothMarketReference(reference.replace(market.nodeId, '0x1234'))).toThrow('Full bytes32');
    expect(() => parseSoothMarketReference(`${reference}:extra`)).toThrow();
  });
  it('builds executable escaped markup only for explicit trusted origins', () => {
    const snippet = renderSoothEmbedSnippet({ origin: 'https://widget.example', market, instance: 'article_123', parentOrigin: 'https://news.example', title: 'Will "A" < B?' });
    expect(snippet).toContain('title="Will &quot;A&quot; &lt; B?"');
    expect(snippet).toContain('allow-popups-to-escape-sandbox');
    const url = new URL(soothWidgetUrl({ origin: 'http://localhost:5173', market, instance: 'article_123' }));
    expect(url.pathname).toBe('/v1/market');
    expect(url.searchParams.get('market')).toBe(reference);
    expect(() => soothWidgetUrl({ origin: 'http://widget.example', market, instance: 'article_123' })).toThrow('HTTPS');
    expect(() => soothWidgetUrl({ origin: 'https://widget.example', market, instance: 'article_123', parentOrigin: '*' })).toThrow();
  });
  it('requires exact origin, source, instance and full market for every accepted message', () => {
    const source = window;
    const data = { protocol: SOOTH_EMBED_PROTOCOL, instance: 'article_123', market: reference, event: { type: 'transaction-confirmed', hash: `0x${'55'.repeat(32)}`, chainId: 46630 } };
    const options = { origin: 'https://widget.example', source, instance: 'article_123', market: reference };
    const event = new MessageEvent('message', { origin: options.origin, source, data });
    expect(acceptsSoothEmbedMessage(event, options)).toBe(true);
    expect(acceptsSoothEmbedMessage(event, { ...options, origin: 'https://widget.example.attacker.invalid' })).toBe(false);
    expect(acceptsSoothEmbedMessage(event, { ...options, source: null })).toBe(false);
    expect(acceptsSoothEmbedMessage(event, { ...options, instance: 'another_123' })).toBe(false);
    expect(acceptsSoothEmbedMessage(event, { ...options, market: formatSoothMarketReference({ ...market, venue: 'amm' }) })).toBe(false);
    expect(acceptsSoothEmbedMessage(new MessageEvent('message', { origin: options.origin, source, data: { ...data, event: { type: 'sign', data: '0x' } } }), options)).toBe(false);
    expect(acceptsSoothEmbedMessage(new MessageEvent('message', { origin: options.origin, source, data: { ...data, event: { type: 'resize', height: 50000 } } }), options)).toBe(false);
  });
});
