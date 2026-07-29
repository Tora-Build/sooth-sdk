import { describe, expect, it, vi } from 'vitest';
import {
  getSimulationPacingDelayMs,
  isRpcRateLimitError,
  withRpcRateLimitRetry,
} from '../../src/core/actions/simulate-rpc';

describe('simulate RPC guard', () => {
  it('recognizes viem HTTP 429 errors, including nested causes', () => {
    expect(
      isRpcRateLimitError(
        new Error(
          'HTTP request failed.\n\nStatus: 429\nURL: https://rpc.sooth.market/robinhood-testnet',
        ),
      ),
    ).toBe(true);
    expect(isRpcRateLimitError({ cause: { statusCode: 429 } })).toBe(true);
    expect(isRpcRateLimitError(new Error('execution reverted'))).toBe(false);
  });

  it('paces standard Robinhood simulations only', () => {
    expect(getSimulationPacingDelayMs(46630, false)).toBe(1_500);
    expect(getSimulationPacingDelayMs(46630, true)).toBe(0);
    expect(getSimulationPacingDelayMs(84532, false)).toBe(0);
  });

  it('retries the same rate-limited RPC operation after the reset window', async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('Status: 429'))
      .mockResolvedValueOnce('confirmed');
    const report = vi.fn();
    const sleepFn = vi.fn().mockResolvedValue(undefined);

    await expect(
      withRpcRateLimitRetry(operation, report, 'BUYYES submission', { sleepFn }),
    ).resolves.toBe('confirmed');

    expect(operation).toHaveBeenCalledTimes(2);
    expect(sleepFn).toHaveBeenCalledWith(60_000);
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'warn',
        message: expect.stringContaining('retrying in 60s (1/3)'),
      }),
    );
  });

  it('does not retry contract failures', async () => {
    const failure = new Error('execution reverted');
    const operation = vi.fn<() => Promise<never>>().mockRejectedValue(failure);
    const sleepFn = vi.fn().mockResolvedValue(undefined);

    await expect(
      withRpcRateLimitRetry(operation, vi.fn(), 'BUYYES submission', { sleepFn }),
    ).rejects.toBe(failure);
    expect(operation).toHaveBeenCalledTimes(1);
    expect(sleepFn).not.toHaveBeenCalled();
  });
});
