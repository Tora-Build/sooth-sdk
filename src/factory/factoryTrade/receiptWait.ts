// Pure; no app binding.
import type { Hex } from 'viem';

/**
 * The wait for a sent transaction's receipt.
 *
 * viem's `waitForTransactionReceipt` gives up early on an endpoint whose
 * nodes are not all at the same head: once it has seen the transaction in a
 * block, it asks for the receipt once more and rejects with
 * `TransactionReceiptNotFoundError` when the node asked does not have it yet
 * (its replacement check, viem 2.45.1 `waitForTransactionReceipt.js`). The
 * transaction is on chain; only this page has not seen it. Seen on Sepolia
 * on 2026-10-13: an approval landed, the page said the trade had failed.
 *
 * So a wait that ends with "not found" is not a failure while the budget
 * lasts: the same hash is asked of every source (the wallet transport and
 * the build's anchor endpoints) every `RECEIPT_POLL_MS`, and any one that
 * has the receipt is enough. A receipt only tells the page to go on; the
 * next step simulates again and the binding stays as it is.
 */
export const RECEIPT_BUDGET_MS = 180_000;
export const RECEIPT_POLL_MS = 1_750;

export interface ReceiptSource<R> {
  name: string;
  /** The receipt, or null (or a `TransactionReceiptNotFoundError`) when this source does not have it. */
  getTransactionReceipt: (hash: Hex) => Promise<R | null>;
}

/** The budget ended and no source had a receipt for the hash. The transaction may still be on chain. */
export class ReceiptNotSeenError extends Error {
  constructor(
    readonly hash: Hex,
    readonly askedMs: number,
  ) {
    super(`No RPC source had a receipt for ${hash} after ${askedMs} ms.`);
    this.name = 'ReceiptNotSeenError';
  }
}

/** True when the wait ended without a receipt, not with a failure of the transaction. */
export function isReceiptNotFound(error: unknown): boolean {
  const seen = new Set<object>();
  let current = error;
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    const item = current as { name?: unknown; message?: unknown; cause?: unknown };
    if (
      typeof item.message === 'string' &&
      (item.name === 'TransactionReceiptNotFoundError' ||
        item.name === 'TransactionNotFoundError' ||
        item.name === 'WaitForTransactionReceiptTimeoutError')
    )
      return true;
    current = item.cause;
  }
  return false;
}

export async function awaitReceipt<R extends { transactionHash: string; status: string }>(input: {
  hash: Hex;
  /** viem's wait, given the remaining budget as its timeout. */
  wait: (timeoutMs: number) => Promise<R>;
  sources: readonly ReceiptSource<R>[];
  budgetMs?: number;
  pollMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}): Promise<R> {
  const budgetMs = input.budgetMs ?? RECEIPT_BUDGET_MS;
  const pollMs = input.pollMs ?? RECEIPT_POLL_MS;
  const now = input.now ?? (() => Date.now());
  const sleep =
    input.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const started = now();
  const checked = (receipt: R): R => {
    if (
      receipt.transactionHash.toLowerCase() !== input.hash.toLowerCase() ||
      (receipt.status !== 'success' && receipt.status !== 'reverted')
    )
      throw new Error('Receipt does not identify the submitted transaction');
    return receipt;
  };
  try {
    return checked(await input.wait(budgetMs));
  } catch (error) {
    if (!isReceiptNotFound(error)) throw error;
  }
  while (now() - started < budgetMs) {
    const results = await Promise.allSettled(
      input.sources.map(async (source) => {
        const receipt = await source.getTransactionReceipt(input.hash);
        return receipt === null ? null : checked(receipt);
      }),
    );
    const found = results.find(
      (result): result is PromiseFulfilledResult<Awaited<R>> =>
        result.status === 'fulfilled' && result.value !== null,
    );
    if (found) return found.value;
    await sleep(pollMs);
  }
  throw new ReceiptNotSeenError(input.hash, now() - started);
}
