import snapshot from '../../data/nodes.snapshot.json';
import { describe, expect, it } from 'vitest';

describe('embedded nodes snapshot', () => {
  it('ships every registered node (0.2.1 legacy + 0.4.0 dual-token)', () => {
    expect(snapshot.nodes.map((node) => node.id).sort()).toEqual([
      '08c5ea8a', // robinhood  0.2.1
      '0d896a4f', // eth-sepolia 0.2.1
      '25c79bf3', // robinhood  0.4.0  EAST amm / USDG book
      '2c932f19', // megaeth    0.4.0  EAST amm / USDC book
      '3b02bcfd', // megaeth    0.2.1
      '6801c7b9', // megaeth    0.4.0-wrmb
      '8d69658b', // base-sepolia 0.2.1 (recorded, not indexed)
      'b08886d3', // eth-sepolia 0.4.0
      'cb83aa61', // eth-sepolia 0.4.0-wrmb
    ]);
  });

  it('only carries core versions the SDK knows how to talk to', () => {
    const known = new Set(['0.2.1', '0.4.0', '0.4.0-wrmb']);
    for (const node of snapshot.nodes) {
      expect(known.has(node.coreVersion), `unknown coreVersion on ${node.id}`).toBe(true);
    }
  });

  it('declares a chain entry for every node', () => {
    const chains = new Set(Object.keys(snapshot.chains));
    for (const node of snapshot.nodes) {
      expect(chains.has(String(node.chainId)), `no chain entry for ${node.id}`).toBe(true);
    }
  });

  it('gives 0.4.0+ nodes both venue tokens with explicit decimals', () => {
    for (const node of snapshot.nodes.filter((n) => n.coreVersion.startsWith('0.4.'))) {
      const c = node.contracts as Record<string, unknown>;
      for (const field of ['baseToken', 'baseTokenDecimals', 'bookToken', 'bookTokenDecimals']) {
        expect(c[field], `${node.id} missing ${field}`).toBeDefined();
      }
    }
  });
});
