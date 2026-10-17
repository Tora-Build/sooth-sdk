import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { isReceiptNotFound, awaitReceipt } from '../../src/factory/factoryTrade/receiptWait.js';
import { isContractRevert, readAtReceipt } from '../../src/factory/factoryTrade/afterReceipt.js';

// A separate JS realm has no shared Error or viem class identity with the SDK.
function foreignError(name: string, message: string): Error {
  return runInNewContext('Object.assign(new Error(message), { name })', { name, message }) as Error;
}

describe('errors crossing package and realm boundaries', () => {
  it.each(['TransactionNotFoundError', 'TransactionReceiptNotFoundError', 'WaitForTransactionReceiptTimeoutError'])(
    'recognizes a wrapped foreign %s without matching generic text',
    (name) => {
      const error = foreignError(name, 'Receipt unavailable');
      expect(error instanceof Error).toBe(false);
      expect(isReceiptNotFound(new Error('Transport wrapper', { cause: error }))).toBe(true);
      expect(isReceiptNotFound(foreignError('Error', 'Transaction receipt not found'))).toBe(false);
    },
  );

  it('continues receipt discovery after a foreign timeout', async () => {
    const hash = `0x${'12'.repeat(32)}` as const;
    const receipt = { transactionHash: hash, status: 'success' };
    const result = await awaitReceipt({
      hash,
      wait: async () => { throw foreignError('WaitForTransactionReceiptTimeoutError', 'Timed out'); },
      sources: [{ name: 'independent', getTransactionReceipt: async () => receipt }],
      budgetMs: 100,
      now: () => 0,
    });
    expect(result).toBe(receipt);
  });

  it('does not retry a wrapped foreign contract refusal', async () => {
    const error = new Error('Call failed', { cause: foreignError('ContractFunctionRevertedError', 'Unauthorized') });
    const read = vi.fn(async () => { throw error; });
    const wait = vi.fn(async () => {});
    expect(isContractRevert(error)).toBe(true);
    await expect(readAtReceipt(123n, read, wait)).rejects.toBe(error);
    expect(read).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });

  it('preserves retries for unavailable blocks even inside a foreign revert wrapper', async () => {
    const error = foreignError('ContractFunctionRevertedError', 'Call failed');
    Object.assign(error, { cause: Object.assign(foreignError('RpcRequestError', 'RPC failed'), { details: 'block 123 could not be found' }) });
    const read = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce(7n);
    const wait = vi.fn(async () => {});
    expect(isContractRevert(error)).toBe(false);
    await expect(readAtReceipt(123n, read, wait)).resolves.toBe(7n);
    expect(wait).toHaveBeenCalledTimes(1);
  });

  it('terminates on cyclic causes and rejects non-error shapes', () => {
    const error = foreignError('Error', 'RPC failed');
    Object.assign(error, { cause: error });
    expect(isReceiptNotFound(error)).toBe(false);
    expect(isContractRevert(error)).toBe(false);
    expect(isReceiptNotFound({ name: 'TransactionNotFoundError' })).toBe(false);
    expect(isContractRevert({ name: 'ContractFunctionRevertedError' })).toBe(false);
  });
});
