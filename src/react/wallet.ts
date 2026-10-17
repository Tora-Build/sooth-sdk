import {
  BaseError,
  BlockNotFoundError,
  decodeFunctionData,
  erc20Abi,
  type Address,
  type EIP1193Provider,
  type Hash,
  type Hex,
  type PublicClient,
  type TransactionReceipt,
  type WalletClient,
} from 'viem';
import { assertFactoryTransactionReceipt } from '../factory/factoryReceipt.js';
import { isReceiptNotFound } from '../factory/factoryTrade/receiptWait.js';
import { formatSoothMarketReference, parseSoothMarketReference } from './embed.js';

export interface SoothWalletSession {
  account: Address;
  chainId: number;
}
export interface SoothWalletAdapter {
  /** Call from the user's connect action. Reading a session never requests access. */
  connect(): Promise<SoothWalletSession>;
  getSession(): Promise<SoothWalletSession | null>;
  /** Call only from the user's chain-switch action. Sending never switches chains. */
  switchChain(chainId: number): Promise<void>;
  sendTransaction(request: {
    account: Address;
    chainId: number;
    to: Address;
    data: Hex;
    value: bigint;
  }): Promise<Hash>;
  subscribe?(listener: () => void): () => void;
}

type SendRequest = Parameters<SoothWalletAdapter['sendTransaction']>[0];
const sameHex = (left: unknown, right: string): boolean =>
  typeof left === 'string' && left.toLowerCase() === right.toLowerCase();
function address(value: unknown): Address {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(value) || /^0x0{40}$/.test(value))
    throw new Error('A nonzero EVM address is required');
  return value.toLowerCase() as Address;
}
function hash(value: unknown): Hash {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value))
    throw new Error('A full transaction hash is required');
  return value.toLowerCase() as Hash;
}
function dataHex(value: unknown): Hex {
  if (typeof value !== 'string' || !/^0x(?:[0-9a-fA-F]{2})*$/.test(value))
    throw new Error('Byte-aligned transaction calldata is required');
  return value.toLowerCase() as Hex;
}
function chainId(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0)
    throw new Error('A positive safe chain ID is required');
  return value;
}
function rpcChainId(value: unknown): number {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]+$/.test(value))
    throw new Error('The wallet returned an invalid chain ID');
  return chainId(Number(value));
}
function selectedAccount(accounts: unknown): Address | null {
  if (!Array.isArray(accounts)) throw new Error('The wallet returned invalid accounts');
  return accounts.length ? address(accounts[0]) : null;
}
function requireSession(session: SoothWalletSession | null): SoothWalletSession {
  if (!session) throw new Error('Connect a wallet account before continuing');
  return session;
}
function checkedRequest(request: SendRequest): SendRequest {
  if (typeof request.value !== 'bigint' || request.value < 0n)
    throw new Error('Transaction value must be a nonnegative bigint');
  return {
    account: address(request.account),
    chainId: chainId(request.chainId),
    to: address(request.to),
    data: dataHex(request.data),
    value: request.value,
  };
}
function assertSession(session: SoothWalletSession | null, request: SendRequest): void {
  const current = requireSession(session);
  if (!sameHex(current.account, request.account))
    throw new Error('Wallet account changed; review the transaction again');
  if (current.chainId !== request.chainId)
    throw new Error('Wallet chain changed; switch chains before sending');
}
function rpcTransaction(request: SendRequest) {
  return {
    from: request.account,
    chainId: `0x${request.chainId.toString(16)}` as Hex,
    to: request.to,
    data: request.data,
    value: `0x${request.value.toString(16)}` as Hex,
  };
}

export function createEip1193WalletAdapter(provider: EIP1193Provider): SoothWalletAdapter {
  const getSession = async (): Promise<SoothWalletSession | null> => {
    const account = selectedAccount(await provider.request({ method: 'eth_accounts' }));
    return account
      ? { account, chainId: rpcChainId(await provider.request({ method: 'eth_chainId' })) }
      : null;
  };
  const adapter: SoothWalletAdapter = {
    async connect() {
      await provider.request({ method: 'eth_requestAccounts' });
      return requireSession(await getSession());
    },
    getSession,
    async switchChain(id) {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId(id).toString(16)}` }],
      });
      if (rpcChainId(await provider.request({ method: 'eth_chainId' })) !== id)
        throw new Error('The wallet did not switch to the requested chain');
    },
    async sendTransaction(input) {
      const request = checkedRequest(input);
      assertSession(await getSession(), request);
      return hash(
        await provider.request({
          method: 'eth_sendTransaction',
          params: [rpcTransaction(request)],
        }),
      );
    },
  };
  if (typeof provider.on === 'function' && typeof provider.removeListener === 'function') {
    adapter.subscribe = (listener) => {
      const notify = () => listener();
      const events = ['accountsChanged', 'chainChanged', 'connect', 'disconnect'] as const;
      for (const event of events) provider.on(event, notify);
      return () => {
        for (const event of events) provider.removeListener(event, notify);
      };
    };
  }
  return adapter;
}

export function createViemWalletAdapter(wallet: WalletClient): SoothWalletAdapter {
  const getSession = async (): Promise<SoothWalletSession | null> => {
    const account = selectedAccount(await wallet.getAddresses());
    return account ? { account, chainId: chainId(await wallet.getChainId()) } : null;
  };
  return {
    async connect() {
      if (wallet.account?.type !== 'local') await wallet.requestAddresses();
      return requireSession(await getSession());
    },
    getSession,
    async switchChain(id) {
      await wallet.switchChain({ id: chainId(id) });
      if (chainId(await wallet.getChainId()) !== id)
        throw new Error('The wallet did not switch to the requested chain');
    },
    async sendTransaction(input) {
      const request = checkedRequest(input);
      assertSession(await getSession(), request);
      if (wallet.account?.type === 'local') {
        // Preserve the signer, pin the chain, and keep calldata identical to the simulated call.
        return hash(
          await wallet.sendTransaction({
            ...request,
            account: wallet.account,
            chain: wallet.chain?.id === request.chainId ? wallet.chain : null,
            dataSuffix: '0x',
          }),
        );
      }
      // Pin the chain in the RPC payload even when the client's configured chain is stale after a switch.
      return hash(
        await wallet.request(
          { method: 'eth_sendTransaction', params: [rpcTransaction(request)] },
          { retryCount: 0 },
        ),
      );
    },
  };
}

export function getInjectedSoothWallet(): SoothWalletAdapter | null {
  try {
    if (typeof window === 'undefined' || !('ethereum' in window)) return null;
    const injected = window.ethereum;
    if (
      !injected ||
      typeof injected !== 'object' ||
      !('request' in injected) ||
      typeof injected.request !== 'function'
    )
      return null;
    // The request boundary is checked here; event methods are checked by the adapter.
    const provider = injected as EIP1193Provider;
    return createEip1193WalletAdapter(provider);
  } catch {
    return null;
  }
}

export interface SoothPendingTransaction {
  version: 1;
  market: string;
  account: Address;
  chainId: number;
  hash: Hash;
  to: Address;
  data: Hex;
  submittedAt: number;
  label: string;
}
function marketReference(value: unknown): string {
  if (typeof value !== 'string') throw new Error('A full Sooth market reference is required');
  const canonical = formatSoothMarketReference(parseSoothMarketReference(value));
  if (canonical.toLowerCase() !== value.toLowerCase())
    throw new Error('A full canonical Sooth market reference is required');
  return canonical;
}
function pendingRecord(value: unknown): SoothPendingTransaction {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid pending transaction');
  const input = value as Record<string, unknown>;
  if (
    input.version !== 1 ||
    typeof input.label !== 'string' ||
    !input.label.trim() ||
    typeof input.submittedAt !== 'number' ||
    !Number.isSafeInteger(input.submittedAt) ||
    input.submittedAt < 0
  )
    throw new Error('Invalid pending transaction metadata');
  const market = marketReference(input.market);
  const id = chainId(input.chainId);
  if (parseSoothMarketReference(market).chainId !== id)
    throw new Error('Pending transaction chain does not match its market reference');
  return {
    version: 1,
    market,
    account: address(input.account),
    chainId: id,
    hash: hash(input.hash),
    to: address(input.to),
    data: dataHex(input.data),
    submittedAt: input.submittedAt,
    label: input.label,
  };
}
function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : (window.localStorage ?? null);
  } catch {
    return null;
  }
}

/** Probe shared durable storage before signing; success does not guarantee a later write. */
export function canPersistSoothPending(): boolean {
  const store = storage();
  if (!store) return false;
  const key = `sooth:pending:probe:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  let written = false;
  try {
    // Never overwrite a preexisting key, even on a random-key collision.
    if (store.getItem(key) !== null) return false;
    written = true;
    store.setItem(key, key);
    if (store.getItem(key) !== key) return false;
    store.removeItem(key);
    written = false;
    return store.getItem(key) === null;
  } catch {
    return false;
  } finally {
    if (written) {
      try {
        store.removeItem(key);
      } catch {
        /* Storage became unavailable during the probe. */
      }
    }
  }
}
const documentPending = new WeakMap<Window, Map<string, SoothPendingTransaction[]>>();
function pendingMemory(): Map<string, SoothPendingTransaction[]> | null {
  if (typeof window === 'undefined') return null;
  let records = documentPending.get(window);
  if (!records) {
    records = new Map();
    documentPending.set(window, records);
  }
  return records;
}
const pendingKey = (market: string) => `sooth:pending:v1:${market}`;
function storedEntries(store: Storage, key: string): unknown[] {
  const raw = store.getItem(key);
  if (raw === null) return [];
  const entries: unknown = JSON.parse(raw);
  if (!Array.isArray(entries)) throw new Error('Unrecognized pending transaction storage');
  return entries;
}
function matchingRecord(
  value: unknown,
  market: string,
  transactionHash?: Hash,
): SoothPendingTransaction | null {
  try {
    const record = pendingRecord(value);
    return record.market === market &&
      (transactionHash === undefined || sameHex(record.hash, transactionHash))
      ? record
      : null;
  } catch {
    return null;
  }
}

/** Reads only this full market reference. Unrecognized records remain stored for recovery. */
export function loadSoothPending(market: string): SoothPendingTransaction[] {
  try {
    const reference = marketReference(market);
    const records = (pendingMemory()?.get(reference) ?? []).map((record) => ({ ...record }));
    const store = storage();
    if (!store) return records;
    try {
      for (const value of storedEntries(store, pendingKey(reference))) {
        const record = matchingRecord(value, reference);
        if (
          record &&
          !records.some(
            (current) => current.hash === record.hash && current.account === record.account,
          )
        )
          records.push(record);
      }
    } catch {
      /* Keep the document's submitted transactions when durable storage cannot be read. */
    }
    return records;
  } catch {
    return [];
  }
}

/** False means no durable copy was written; callers must keep the submitted hash visible. */
export function saveSoothPending(record: SoothPendingTransaction): boolean {
  try {
    const valid = pendingRecord(record);
    const memory = pendingMemory();
    if (memory) {
      const records = memory.get(valid.market) ?? [];
      const existing = records.findIndex(
        (prior) => prior.hash === valid.hash && prior.account === valid.account,
      );
      if (existing < 0) records.push(valid);
      else records[existing] = valid;
      memory.set(valid.market, records);
    }
    const store = storage();
    if (!store) return false;
    const key = pendingKey(valid.market);
    const entries = storedEntries(store, key);
    const index = entries.findIndex((value) => {
      const prior = matchingRecord(value, valid.market, valid.hash);
      return prior && sameHex(prior.account, valid.account);
    });
    if (index < 0) entries.push(valid);
    else entries[index] = valid;
    const serialized = JSON.stringify(entries);
    store.setItem(key, serialized);
    if (store.getItem(key) !== serialized) return false;
    // Durable state belongs to shared storage so removal in another window stays visible.
    const fallback = memory?.get(valid.market);
    if (memory && fallback) {
      const remaining = fallback.filter(
        (prior) => prior.hash !== valid.hash || prior.account !== valid.account,
      );
      if (remaining.length) memory.set(valid.market, remaining);
      else memory.delete(valid.market);
    }
    return true;
  } catch {
    return false;
  }
}

/** Explicit removal only; neither reads nor receipt reconciliation discard pending transactions. */
export function removeSoothPending(market: string, transactionHash: Hash): void {
  try {
    const reference = marketReference(market);
    const validHash = hash(transactionHash);
    const memory = pendingMemory();
    const records = memory?.get(reference);
    if (memory && records) {
      const remaining = records.filter((record) => record.hash !== validHash);
      if (remaining.length) memory.set(reference, remaining);
      else memory.delete(reference);
    }
    const store = storage();
    if (!store) return;
    const key = pendingKey(reference);
    const entries = storedEntries(store, key);
    const remaining = entries.filter((value) => !matchingRecord(value, reference, validHash));
    if (remaining.length === entries.length) return;
    if (remaining.length) store.setItem(key, JSON.stringify(remaining));
    else store.removeItem(key);
  } catch {
    /* Storage may be unavailable even after a successful read. */
  }
}

export type SoothPendingReconciliation =
  | { status: 'pending' }
  | { status: 'confirmed' | 'failed'; receipt: TransactionReceipt };

/** A terminal result is evidence for this exact transaction; the caller owns removal and UI refresh. */
export async function reconcileSoothPending(
  client: PublicClient,
  pending: SoothPendingTransaction,
): Promise<SoothPendingReconciliation> {
  const expected = pendingRecord(pending);
  const currentChainId = chainId(await client.getChainId());
  if (currentChainId !== expected.chainId)
    throw new Error('Pending transaction chain does not match the RPC chain');
  const [receiptResult, transactionResult] = await Promise.allSettled([
    client.getTransactionReceipt({ hash: expected.hash }),
    client.getTransaction({ hash: expected.hash }),
  ]);
  const receipt = receiptResult.status === 'fulfilled' ? receiptResult.value : null;
  const transaction = transactionResult.status === 'fulfilled' ? transactionResult.value : null;
  for (const result of [receiptResult, transactionResult]) {
    if (result.status === 'rejected' && !isReceiptNotFound(result.reason)) throw result.reason;
  }
  if (!receipt || !transaction) return { status: 'pending' };
  let block;
  try {
    block = await client.getBlock({ blockNumber: receipt.blockNumber });
  } catch (error) {
    if (
      isReceiptNotFound(error) ||
      error instanceof BlockNotFoundError ||
      (error instanceof BaseError &&
        error.walk((cause) => cause instanceof BlockNotFoundError) !== null)
    )
      return { status: 'pending' };
    throw error;
  }
  let allowApprovalAmountChange = false;
  if (expected.data.slice(0, 10).toLowerCase() === '0x095ea7b3') {
    try {
      const approval = decodeFunctionData({ abi: erc20Abi, data: expected.data });
      allowApprovalAmountChange = approval.functionName === 'approve' && approval.args[1] > 0n;
    } catch {
      /* Malformed calldata remains subject to exact identity comparison. */
    }
  }
  // Factory calls carry no native value. Wallet-edited grants still bind token and spender;
  // zero-allowance resets and every other call retain exact calldata identity.
  assertFactoryTransactionReceipt(
    { ...expected, value: 0n },
    expected.hash,
    currentChainId,
    transaction,
    receipt,
    block,
    { allowApprovalAmountChange },
  );
  if (receipt.status === 'success') return { status: 'confirmed', receipt };
  if (receipt.status === 'reverted') return { status: 'failed', receipt };
  throw new Error('Unrecognized pending transaction receipt status');
}
