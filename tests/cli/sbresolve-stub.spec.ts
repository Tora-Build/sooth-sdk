import { describe, expect, it, vi } from 'vitest';
import { resolve } from '../../src/cli/commands/soothbook';
import type { CommandContext } from '../../src/cli/commands/types';

describe('sbresolve v0.2.1 stub', () => {
  it('returns a deprecation failure without calling resolveMarket', async () => {
    const writeContract = vi.fn();
    const ctx = {
      actorManager: {
        currentWalletClient: () => ({ writeContract }),
      },
      deployment: {
        contracts: { SoothBook: '0x20c0a274aB8D90452859809B3804Ef2cFA595132' },
      },
      config: { confirmations: 1 },
      marketKey: `0x${'11'.repeat(32)}`,
    } as unknown as CommandContext;

    const result = await resolve(ctx, ['yes']);

    // The command is a deliberate warn-stub since v0.2.1 — it must fail
    // gracefully with guidance, never attempt the deleted on-chain call.
    expect(result.success).toBe(false);
    expect(writeContract).not.toHaveBeenCalled();
    expect(result.message).toContain('resolveMarket was deleted');
    expect(result.message).toContain('adjudicator lifecycle');
  });
});
