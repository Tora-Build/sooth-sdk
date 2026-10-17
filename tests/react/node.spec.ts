import { describe, expect, it } from 'vitest';
import { formatSoothNodeReference, isSoothNodeScope, parseSoothNodeReference, soothNodeVenue, type SoothNodeReference } from '../../src/react/node.js';

const reference: SoothNodeReference = {
  chainId: 46630,
  factory: `0x${'aB'.repeat(20)}`,
  nodeId: `0x${'cD'.repeat(32)}`,
  releaseId: `0x${'eF'.repeat(32)}`,
};
describe('node references and feature boundaries', () => {
  it('round trips every identity field and normalizes case', () => {
    const encoded = formatSoothNodeReference(reference);
    expect(encoded).toBe(`sooth:node:v1:46630:${reference.factory.toLowerCase()}:${reference.nodeId.toLowerCase()}:${reference.releaseId.toLowerCase()}`);
    expect(parseSoothNodeReference(encoded)).toEqual({ ...reference, factory: reference.factory.toLowerCase(), nodeId: reference.nodeId.toLowerCase(), releaseId: reference.releaseId.toLowerCase() });
  });
  it.each([
    'sooth:node:v2:46630:factory:node:release',
    'sooth:node:v1:46630:factory:node:release',
    'sooth:node:v1:46630',
    `${formatSoothNodeReference(reference)}:https://untrusted.example`,
    formatSoothNodeReference(reference).replace(':46630:', ':0:'),
    formatSoothNodeReference(reference).replace(reference.factory.toLowerCase(), `0x${'0'.repeat(40)}`),
  ])('rejects incomplete or untrusted identity syntax %s', (value) => {
    expect(() => parseSoothNodeReference(value)).toThrow();
  });
  it('matches all three catalog scope dimensions', () => {
    expect(isSoothNodeScope(reference, parseSoothNodeReference(reference))).toBe(true);
    expect(isSoothNodeScope(reference, { ...reference, chainId: 1 })).toBe(false);
    expect(isSoothNodeScope(reference, { ...reference, factory: `0x${'1'.repeat(40)}` })).toBe(false);
    expect(isSoothNodeScope(reference, { ...reference, nodeId: `0x${'1'.repeat(64)}` })).toBe(false);
  });
  it('always exposes AMM and requires explicit CLOB opt in', () => {
    expect(soothNodeVenue(undefined, 'book')).toBe('amm');
    expect(soothNodeVenue({ create: true, clob: false }, 'book')).toBe('amm');
    expect(soothNodeVenue({ clob: true })).toBe('amm');
    expect(soothNodeVenue({ clob: true }, 'book')).toBe('book');
  });
});
