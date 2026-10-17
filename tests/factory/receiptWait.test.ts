import { TransactionNotFoundError, TransactionReceiptNotFoundError, WaitForTransactionReceiptTimeoutError } from 'viem';
import { describe, expect, it, vi } from 'vitest';
import { awaitReceipt, isReceiptNotFound, RECEIPT_BUDGET_MS, RECEIPT_POLL_MS, ReceiptNotSeenError, type ReceiptSource } from '../../src/factory/factoryTrade/receiptWait.js';

const hash = '0x8459659100000000000000000000000000000000000000000000000000000000af18' as const;
interface R { status: string; transactionHash: string }
const receipt: R = { status: 'success', transactionHash: hash };

/** A clock that moves only when the wait sleeps. */
function clock() {
  let t = 0;
  const sleeps: number[] = [];
  return { now: () => t, sleep: async (ms: number) => { sleeps.push(ms); t += ms; }, sleeps };
}
const source = (name: string, answers: (R | null | Error)[]): ReceiptSource<R> & { asked: number } => {
  const s = {
    name,
    asked: 0,
    getTransactionReceipt: vi.fn(async () => {
      s.asked += 1;
      const next = answers.length > 1 ? answers.shift()! : answers[0];
      if (next instanceof Error) throw next;
      return next;
    }),
  };
  return s;
};

describe('awaitReceipt', () => {
  it('has a 180 s budget and asks every 1.75 s', () => {
    expect(RECEIPT_BUDGET_MS).toBe(180_000);
    expect(RECEIPT_POLL_MS).toBe(1_750);
  });

  it('a wait that rejects with "receipt not found" is not a failure: the hash is asked again until a source has it', async () => {
    const c = clock();
    const wallet = source('wallet', [null, null, receipt]);
    const wait = vi.fn(async () => { throw new TransactionReceiptNotFoundError({ hash }); });
    const got = await awaitReceipt<R>({ hash, wait, sources: [wallet], budgetMs: 180_000, pollMs: 1_750, now: c.now, sleep: c.sleep });
    expect(got).toBe(receipt);
    expect(wait).toHaveBeenCalledWith(180_000);
    expect(wallet.asked).toBe(3);
    expect(c.sleeps).toEqual([1_750, 1_750]);
  });

  it('any one source with the receipt is enough; a source that throws or answers null is passed over', async () => {
    const c = clock();
    const wallet = source('wallet', [new TransactionReceiptNotFoundError({ hash })]);
    const anchorA = source('a.example', [new Error('connection refused')]);
    const anchorB = source('b.example', [null, receipt]);
    const got = await awaitReceipt<R>({ hash, wait: async () => { throw new TransactionNotFoundError({ hash }); }, sources: [wallet, anchorA, anchorB], budgetMs: 10_000, pollMs: 2_000, now: c.now, sleep: c.sleep });
    expect(got).toBe(receipt);
    expect(anchorB.asked).toBe(2);
    expect(wallet.asked).toBe(2);
  });

  it('when the budget ends with no receipt it throws ReceiptNotSeenError with the hash, and nothing else', async () => {
    const c = clock();
    const wallet = source('wallet', [null]);
    const p = awaitReceipt<R>({ hash, wait: async () => { throw new WaitForTransactionReceiptTimeoutError({ hash }); }, sources: [wallet], budgetMs: 10_000, pollMs: 2_000, now: c.now, sleep: c.sleep });
    await expect(p).rejects.toBeInstanceOf(ReceiptNotSeenError);
    await p.catch((error: ReceiptNotSeenError) => {
      expect(error.hash).toBe(hash);
      expect(error.askedMs).toBe(10_000);
    });
    expect(wallet.asked).toBe(5);
  });

  it('a wait that resolves is returned as is; any other failure of the wait is thrown as is, with no polling', async () => {
    const wallet = source('wallet', [receipt]);
    expect(await awaitReceipt<R>({ hash, wait: async () => receipt, sources: [wallet] })).toBe(receipt);
    expect(wallet.asked).toBe(0);
    await expect(awaitReceipt<R>({ hash, wait: async () => { throw new Error('boom'); }, sources: [wallet] })).rejects.toThrow('boom');
    expect(wallet.asked).toBe(0);
  });

  it('refuses a mismatched initial receipt and skips mismatched fallback sources', async () => {
    const wrong = { ...receipt, transactionHash: `0x${'ab'.repeat(32)}` };
    await expect(awaitReceipt({ hash, wait: async () => wrong, sources: [] })).rejects.toThrow();
    const c = clock();
    const got = await awaitReceipt({ hash, wait: async () => { throw new TransactionNotFoundError({ hash }); }, sources: [source('wrong', [wrong]), source('right', [receipt])], budgetMs: 100, pollMs: 10, now: c.now, sleep: c.sleep });
    expect(got).toBe(receipt);
  });

  it('isReceiptNotFound names the three viem outcomes and nothing else', () => {
    expect(isReceiptNotFound(new TransactionReceiptNotFoundError({ hash }))).toBe(true);
    expect(isReceiptNotFound(new TransactionNotFoundError({ hash }))).toBe(true);
    expect(isReceiptNotFound(new WaitForTransactionReceiptTimeoutError({ hash }))).toBe(true);
    expect(isReceiptNotFound(new Error('Transaction receipt with hash could not be found'))).toBe(false);
    expect(isReceiptNotFound(null)).toBe(false);
  });
});
