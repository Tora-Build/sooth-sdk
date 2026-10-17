import {
  BlockNotFoundError,
  BaseError,
  decodeFunctionData,
  erc20Abi,
  type Address,
  type Hash,
  type Hex,
  type TransactionReceipt,
} from 'viem';
import { assertFactoryTransactionReceipt } from '../factory/factoryReceipt.js';
import { isReceiptNotFound } from '../factory/factoryTrade/receiptWait.js';
import { assertMarketBinding } from '../factory/factoryClient.js';
import { decodeFactoryCreatedMarket } from '../factory/factoryTransactions.js';
import { formatSoothNodeReference, parseSoothNodeReference } from './node.js';
import type { SoothResolvedNode } from './runtime.js';

export interface SoothPendingCreation {
  version: 1;
  node: string;
  account: Address;
  chainId: number;
  hash: Hash;
  to: Address;
  data: Hex;
  kind: 'approveCreation' | 'createMarket';
  submittedAt: number;
}
const memory = new Map<string, SoothPendingCreation[]>();
const key = (node: string) => `sooth:creation:pending:v1:${node}`;
function store(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}
function checked(value: unknown): SoothPendingCreation {
  if (!value || typeof value !== 'object') throw new Error('Invalid pending creation');
  const p = value as SoothPendingCreation;
  const ref = parseSoothNodeReference(p.node);
  if (
    p.version !== 1 ||
    formatSoothNodeReference(ref) !== p.node ||
    p.chainId !== ref.chainId ||
    !/^0x[\da-fA-F]{40}$/.test(p.account) ||
    !/^0x[\da-fA-F]{40}$/.test(p.to) ||
    !/^0x[\da-fA-F]{64}$/.test(p.hash) ||
    !/^0x(?:[\da-fA-F]{2})+$/.test(p.data) ||
    (p.kind !== 'approveCreation' && p.kind !== 'createMarket') ||
    !Number.isSafeInteger(p.submittedAt) ||
    p.submittedAt < 0
  )
    throw new Error('Invalid pending creation identity');
  return { ...p, account: p.account.toLowerCase() as Address, hash: p.hash.toLowerCase() as Hash };
}
function entries(storage: Storage, node: string): unknown[] {
  const value: unknown = JSON.parse(storage.getItem(key(node)) ?? '[]');
  if (!Array.isArray(value)) throw new Error('Unrecognized creation recovery storage');
  return value;
}
function matching(value: unknown, node: string, hash?: Hash): SoothPendingCreation | null {
  try {
    const p = checked(value);
    return p.node === node && (!hash || p.hash === hash.toLowerCase()) ? p : null;
  } catch {
    return null;
  }
}
export function loadSoothPendingCreations(node: string): SoothPendingCreation[] {
  const canonical = formatSoothNodeReference(parseSoothNodeReference(node));
  const records = [...(memory.get(canonical) ?? [])];
  try {
    const storage = store();
    if (storage)
      for (const value of entries(storage, canonical)) {
        const p = matching(value, canonical);
        if (p && !records.some((prior) => prior.hash === p.hash)) records.push(p);
      }
  } catch {
    /* Memory preserves any broadcast whose durable write failed. */
  }
  return records;
}
export function saveSoothPendingCreation(input: SoothPendingCreation): boolean {
  const p = checked(input);
  const records = memory.get(p.node) ?? [];
  memory.set(p.node, [...records.filter((prior) => prior.hash !== p.hash), p]);
  try {
    const storage = store();
    if (!storage) return false;
    const values = entries(storage, p.node).filter((value) => !matching(value, p.node, p.hash));
    values.push(p);
    const serialized = JSON.stringify(values);
    storage.setItem(key(p.node), serialized);
    if (storage.getItem(key(p.node)) !== serialized) return false;
    memory.set(
      p.node,
      (memory.get(p.node) ?? []).filter((prior) => prior.hash !== p.hash),
    );
    return true;
  } catch {
    return false;
  }
}
/** Remove only after exact canonical receipt reconciliation. Unknown records survive. */
export function removeSoothPendingCreation(node: string, hash: Hash): void {
  memory.set(
    node,
    (memory.get(node) ?? []).filter((p) => p.hash !== hash.toLowerCase()),
  );
  try {
    const storage = store();
    if (!storage) return;
    const remaining = entries(storage, node).filter((value) => !matching(value, node, hash));
    if (remaining.length) storage.setItem(key(node), JSON.stringify(remaining));
    else storage.removeItem(key(node));
  } catch {
    /* A stale durable record is safer than permitting a duplicate submission. */
  }
}
export type SoothCreationReconciliation =
  | { status: 'pending' }
  | { status: 'failed'; receipt: TransactionReceipt }
  | { status: 'confirmed'; receipt: TransactionReceipt; market?: Address };
export async function reconcileSoothCreation(
  node: SoothResolvedNode,
  input: SoothPendingCreation,
): Promise<SoothCreationReconciliation> {
  const pending = checked(input);
  if (pending.node !== formatSoothNodeReference(node.reference))
    throw new Error('Pending creation belongs to another node');
  const chainId = await node.client.getChainId();
  if (chainId !== pending.chainId) throw new Error('Pending creation RPC chain mismatch');
  const results = await Promise.allSettled([
    node.client.getTransactionReceipt({ hash: pending.hash }),
    node.client.getTransaction({ hash: pending.hash }),
  ]);
  for (const result of results)
    if (result.status === 'rejected' && !isReceiptNotFound(result.reason)) throw result.reason;
  const [receiptResult, txResult] = results;
  if (receiptResult.status !== 'fulfilled' || txResult.status !== 'fulfilled')
    return { status: 'pending' };
  const receipt = receiptResult.value;
  let block;
  try {
    block = await node.client.getBlock({ blockNumber: receipt.blockNumber });
  } catch (error) {
    if (
      isReceiptNotFound(error) ||
      error instanceof BlockNotFoundError ||
      (error instanceof BaseError && error.walk((cause) => cause instanceof BlockNotFoundError))
    )
      return { status: 'pending' };
    throw error;
  }
  let allowApprovalAmountChange = false;
  if (pending.kind === 'approveCreation') {
    const approval = decodeFunctionData({ abi: erc20Abi, data: pending.data });
    if (
      approval.functionName !== 'approve' ||
      approval.args[0].toLowerCase() !== node.context.contracts.marketFactory.toLowerCase()
    )
      throw new Error('Pending approval spender does not match this node.');
    allowApprovalAmountChange = approval.args[1] > 0n;
  }
  assertFactoryTransactionReceipt(
    { ...pending, value: 0n },
    pending.hash,
    chainId,
    txResult.value,
    receipt,
    block,
    { allowApprovalAmountChange },
  );
  if (receipt.status === 'reverted') return { status: 'failed', receipt };
  if (receipt.status !== 'success') throw new Error('Unrecognized creation receipt status');
  if (pending.kind === 'approveCreation') return { status: 'confirmed', receipt };
  const market = decodeFactoryCreatedMarket({
    context: node.context,
    receipt,
    account: pending.account,
  });
  await assertMarketBinding({
    identity: node.reference,
    release: node.context.release,
    endpoints: node.endpoints,
    catalog: node.context.contracts,
    market,
  });
  return { status: 'confirmed', receipt, market };
}
