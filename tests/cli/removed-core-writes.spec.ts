import { describe, expect, it, vi } from 'vitest';
import { claimrefund, dismiss, finalize } from '../../src/cli/commands/market';
import type { CommandContext } from '../../src/cli/commands/types';
import { runClaimRefund, runDismiss } from '../../src/core/actions/writes';
import type { ActionContext } from '../../src/core/actions/types';

const MARKET = `0x${'44'.repeat(20)}` as const;

describe('removed sooth-core v0.2.1 writes', () => {
  it('keeps action compatibility without encoding deleted LaunchpadEngine calls', async () => {
    const writeContract = vi.fn();
    const ctx = {
      walletClient: { writeContract },
    } as unknown as ActionContext;

    await expect(runDismiss(ctx, { marketAddress: MARKET })).rejects.toThrow(
      'dismissMarket was removed',
    );
    await expect(runClaimRefund(ctx, { marketAddress: MARKET })).rejects.toThrow(
      'claimRefund was removed',
    );
    expect(writeContract).not.toHaveBeenCalled();
  });

  it('keeps legacy CLI commands as explicit no-write stubs', async () => {
    const ctx = {} as CommandContext;

    await expect(finalize(ctx, [])).resolves.toMatchObject({
      success: false,
      message: expect.stringContaining('finalize was removed'),
    });
    await expect(dismiss(ctx, [])).resolves.toMatchObject({
      success: false,
      message: expect.stringContaining('dismissMarket was removed'),
    });
    await expect(claimrefund(ctx, [])).resolves.toMatchObject({
      success: false,
      message: expect.stringContaining('claimRefund was removed'),
    });
  });
});
