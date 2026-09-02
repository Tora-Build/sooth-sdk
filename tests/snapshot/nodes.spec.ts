import snapshot from '../../data/nodes.snapshot.json';
import { describe, expect, it } from 'vitest';

describe('embedded nodes snapshot', () => {
  it('mirrors the sooth-alpha registry manifest', () => {
    expect(snapshot.version).toBe('0.3.1');
    expect(snapshot.nodes.map((node) => node.id).sort()).toEqual([
      '08c5ea8a',
      '0d896a4f',
      '25c79bf3',
      '3b02bcfd',
      '8d69658b',
    ]);
    expect(Object.keys(snapshot.chains).sort()).toEqual(['11155111', '46630', '6343', '84532']);
  });

  it('keeps the CLI-supported v0.2.1 nodes indexed and unchanged', () => {
    // The CLI refuses any node whose coreVersion !== SUPPORTED_CORE_VERSION,
    // so this is the set it can actually drive.
    const v021 = snapshot.nodes.filter((node) => node.coreVersion === '0.2.1');
    expect(v021.map((node) => node.id).sort()).toEqual([
      '08c5ea8a',
      '0d896a4f',
      '3b02bcfd',
      '8d69658b',
    ]);
  });

  it('records the core-0.4 dual-token Eastboard node as a FeeVault node, not indexed', () => {
    // 25c79bf3 shares chainId 46630 with 08c5ea8a. It is recorded here so
    // node-id lookups resolve, but `indexed: false` keeps the shared indexer
    // (and any getIndexedNodes() consumer) away from it — Ponder rejects two
    // enabled nodes on one chain.
    const pilot = snapshot.nodes.find((node) => node.id === '25c79bf3');
    expect(pilot).toBeDefined();
    expect(pilot!.coreVersion).toBe('0.4.0');
    expect(pilot!.chainId).toBe(46630);
    expect(pilot!.indexed).toBe(false);

    const contracts = pilot!.contracts as Record<string, unknown>;
    // FeeVault replaced FeeRouter on this release line; they are different
    // contracts with different ABIs and must never both appear.
    expect(contracts.feeVault).toBe('0x71054f3E009A422518dF59dce07e189296394CA2');
    expect('feeRouter' in contracts).toBe(false);
    // Dual-token: the book settles in a different ERC20 (USDG, 6-dec) than the
    // AMM (EAST, 18-dec). The scales differ, so bookTokenDecimals is load-
    // bearing — nothing may fall back to baseTokenDecimals for the book venue.
    expect(contracts.bookToken).toBe('0xf0a5cE5f112d885928b605f1c6D72EBb1C6063dC');
    expect(contracts.baseToken).not.toBe(contracts.bookToken);
    expect(contracts.bookTokenDecimals).toBe(6);
  });
});
