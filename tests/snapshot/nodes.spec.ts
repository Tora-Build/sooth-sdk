import snapshot from '../../data/nodes.snapshot.json';
import { describe, expect, it } from 'vitest';

describe('embedded nodes snapshot', () => {
  it('contains only v0.2.1 nodes (mega + eth-sepolia indexed, base-sepolia recorded)', () => {
    expect(snapshot.version).toBe('0.2.3');
    expect(snapshot.nodes.map((node) => node.id).sort()).toEqual([
      '0d896a4f',
      '3b02bcfd',
      '8d69658b',
    ]);
    expect(snapshot.nodes.every((node) => node.coreVersion === '0.2.1')).toBe(true);
    expect(Object.keys(snapshot.chains).sort()).toEqual(['11155111', '6343', '84532']);
  });
});
