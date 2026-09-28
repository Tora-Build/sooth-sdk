import { afterEach, describe, expect, it } from 'vitest';
import { createConfig, ABIS } from '../../src/cli/config';
import { loadManifest, resetManifest, setManifest } from '../../src/registry-loader';

describe('CLI config', () => {
  afterEach(() => {
    resetManifest();
  });

  it('prefers the native MegaETH RPC while retaining registry fallbacks', async () => {
    const manifest = await loadManifest({ offline: true });
    // RPC ordering remains supported even when no MegaETH node is registered.
    // Inject a configuration-only fixture instead of reviving a retired node.
    setManifest({
      ...manifest,
      nodes: [{ ...manifest.nodes[0], id: '3b02bcfd', chainId: 6343 }],
    });

    const config = createConfig('3b02bcfd');

    expect(config.rpc).toBe('https://carrot.megaeth.com/rpc');
    expect(config.chain.rpcUrls.default.http).toEqual([
      'https://carrot.megaeth.com/rpc',
      'https://rpc.sooth.market/megaeth-testnet',
    ]);
  });

  it('exposes every SoothBook read used by state and registration guards', () => {
    const functionNames = ABIS.SoothBook.filter((item) => item.type === 'function').map(
      (item) => item.name,
    );

    expect(functionNames).toContain('registeredMarkets');
    expect(functionNames).toContain('getImpliedPriceByKey');
  });
});
