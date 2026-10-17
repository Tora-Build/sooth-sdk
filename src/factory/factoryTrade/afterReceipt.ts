/** Receipt floors are scoped to full node identity; one chain cannot pin another. */
import { factoryNodeKey, type FactoryIdentity } from '../factoryClient.js';
const receipts = new Map<string, { block: bigint; at: number }>();
export function noteReceipt(identity: FactoryIdentity, block: bigint, now = Date.now()): void {
  const key = factoryNodeKey(identity);
  const prior = receipts.get(key);
  if (!prior || now - prior.at >= 60_000 || block >= prior.block)
    receipts.set(key, { block, at: now });
}
export function freshReceiptBlock(identity: FactoryIdentity, now = Date.now()): bigint | undefined {
  const receipt = receipts.get(factoryNodeKey(identity));
  return receipt && now - receipt.at < 60_000 ? receipt.block : undefined;
}
export function forgetReceipt(identity: FactoryIdentity): void {
  receipts.delete(factoryNodeKey(identity));
}
export function isContractRevert(error: unknown): boolean {
  const seen = new Set<object>();
  let current = error;
  let reverted = false;
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    const item = current as {
      name?: unknown;
      message?: unknown;
      details?: unknown;
      cause?: unknown;
    };
    if (
      /header not found|unknown block|block not found|block .* could not be found|missing trie node|is not available/i.test(
        `${typeof item.message === 'string' ? item.message : ''} ${typeof item.details === 'string' ? item.details : ''}`,
      )
    )
      return false;
    if (item.name === 'ContractFunctionRevertedError' && typeof item.message === 'string')
      reverted = true;
    current = item.cause;
  }
  return reverted;
}
export async function readAtReceipt<T>(
  block: bigint | undefined,
  read: (blockNumber?: bigint) => Promise<T>,
  wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await read(block);
    } catch (error) {
      if (block === undefined || attempt >= 7 || isContractRevert(error)) throw error;
      await wait(1_500);
    }
  }
}
export async function refreshAt<B extends { number: bigint }, T>(
  identity: FactoryIdentity,
  getBlock: (blockNumber?: bigint) => Promise<B>,
  read: (block: B) => Promise<T>,
  wait?: (ms: number) => Promise<void>,
): Promise<T> {
  const head = await getBlock();
  const floor = freshReceiptBlock(identity);
  return floor === undefined || floor <= head.number
    ? read(head)
    : readAtReceipt(floor, async () => read(await getBlock(floor)), wait);
}
