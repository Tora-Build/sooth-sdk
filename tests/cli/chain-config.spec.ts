import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('../../src/cli/commands/soothbook.ts', import.meta.url),
  'utf8',
);

// Guards the empirically-required getLogs chunk caps (range-limited RPCs).
// Chains without an entry (e.g. Eth Sepolia) intentionally use the default
// chunk — validated live by the v0.2.1 2-chain CLI smoke (9/9 commands).
describe('CLI scan config', () => {
  it('caps getLogs chunks on range-limited chains', () => {
    expect(source).toMatch(/10143:\s*900n/); // Monad: 1k range cap
    expect(source).toMatch(/998:\s*9_000n/); // HyperEVM: 10k cap
    expect(source).toMatch(/6343:\s*9_000n/); // MegaETH: 10k cap
  });

  it('keeps a nonzero default scan chunk for uncapped chains', () => {
    expect(source).toMatch(/DEFAULT_SCAN_CHUNK_SIZE = \d[\d_]*n/);
  });
});
