import { afterEach, describe, expect, it, vi } from 'vitest';
import { BaseError, BlockNotFoundError, TransactionNotFoundError, TransactionReceiptNotFoundError, createWalletClient, custom, encodeFunctionData, erc20Abi, type Address, type EIP1193Provider, type Hash, type PublicClient, type TransactionReceipt, type WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet } from 'viem/chains';
import { formatSoothMarketReference } from '../../src/react/embed.js';
import { canPersistSoothPending, createEip1193WalletAdapter, createViemWalletAdapter, getInjectedSoothWallet, loadSoothPending, reconcileSoothPending, removeSoothPending, saveSoothPending, type SoothPendingTransaction } from '../../src/react/wallet.js';
import { FactoryTransactionIdentityError } from '../../src/factory/factoryReceipt.js';

const ACCOUNT = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Address;
const OTHER_ACCOUNT = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as Address;
const TO = '0xcccccccccccccccccccccccccccccccccccccccc' as Address;
const HASH = `0x${'ab'.repeat(32)}` as Hash;
const OTHER_HASH = `0x${'cd'.repeat(32)}` as Hash;
const MARKET = formatSoothMarketReference({ chainId: 1, factory: TO, nodeId: HASH, market: TO, releaseId: OTHER_HASH, venue: 'amm' });
const request = { account: ACCOUNT, chainId: 1, to: TO, data: '0xabcd' as const, value: 9n };

function providerFixture() {
  const state = { accounts: [ACCOUNT] as unknown, chain: '0x1', sentHash: HASH as unknown, rejected: undefined as unknown, switchIgnored: false };
  const listeners = new Map<string, Set<() => void>>();
  const requestRpc = vi.fn(async (call: { method: string; params?: readonly unknown[] }) => {
    if (state.rejected && (call.method === 'eth_requestAccounts' || call.method === 'eth_sendTransaction' || call.method === 'wallet_switchEthereumChain')) throw state.rejected;
    if (call.method === 'eth_accounts' || call.method === 'eth_requestAccounts') return state.accounts;
    if (call.method === 'eth_chainId') return state.chain;
    if (call.method === 'eth_sendTransaction') return state.sentHash;
    if (call.method === 'wallet_switchEthereumChain') {
      const target = call.params?.[0];
      if (!target || typeof target !== 'object' || !('chainId' in target) || typeof target.chainId !== 'string') throw new Error('Invalid switch parameters');
      if (!state.switchIgnored) state.chain = target.chainId;
      return null;
    }
    throw new Error(`Unexpected RPC method ${call.method}`);
  });
  const provider = {
    request: requestRpc,
    on(event: string, listener: () => void) {
      const callbacks = listeners.get(event) ?? new Set<() => void>();
      callbacks.add(listener);
      listeners.set(event, callbacks);
    },
    removeListener(event: string, listener: () => void) { listeners.get(event)?.delete(listener); },
  } as unknown as EIP1193Provider;
  return { provider, state, requestRpc, listeners };
}

class MemoryStorage implements Storage {
  readonly entries = new Map<string, string>();
  get length(): number { return this.entries.size; }
  clear(): void { this.entries.clear(); }
  getItem(key: string): string | null { return this.entries.get(key) ?? null; }
  key(index: number): string | null { return [...this.entries.keys()][index] ?? null; }
  removeItem(key: string): void { this.entries.delete(key); }
  setItem(key: string, value: string): void { this.entries.set(key, value); }
}
function storageFixture(): MemoryStorage {
  const store = new MemoryStorage();
  vi.stubGlobal('window', { localStorage: store });
  return store;
}
function pendingRecord(overrides: Partial<SoothPendingTransaction> = {}): SoothPendingTransaction {
  return { version: 1, market: MARKET, account: ACCOUNT, chainId: 1, hash: HASH, to: TO, data: '0xabcd', submittedAt: 1, label: 'Buy YES', ...overrides };
}
function receiptFixture(overrides: Partial<TransactionReceipt> = {}): TransactionReceipt {
  return { blockHash: OTHER_HASH, blockNumber: 4n, contractAddress: null, cumulativeGasUsed: 21_000n, effectiveGasPrice: 1n, from: ACCOUNT, gasUsed: 21_000n, logs: [], logsBloom: `0x${'00'.repeat(256)}`, status: 'success', to: TO, transactionHash: HASH, transactionIndex: 0, type: 'eip1559', ...overrides };
}
function publicClientFixture() {
  const receipt = receiptFixture();
  const transaction = { hash: HASH, from: ACCOUNT, to: TO as Address | null, input: '0xabcd', chainId: 1, value: 0n, blockHash: OTHER_HASH, blockNumber: 4n };
  const block = { hash: OTHER_HASH as Hash | null, number: 4n as bigint | null };
  const getBlock = vi.fn(async () => block);
  const getChainId = vi.fn(async () => 1);
  const getTransactionReceipt = vi.fn(async () => receipt);
  const getTransaction = vi.fn(async () => transaction);
  return { receipt, transaction, block, getBlock, getChainId, getTransactionReceipt, getTransaction, client: { getChainId, getTransactionReceipt, getTransaction, getBlock } as unknown as PublicClient };
}
afterEach(() => { vi.unstubAllGlobals(); });

describe('EIP-1193 wallet adapter', () => {
  it('reads sessions without requesting permission and connects only explicitly', async () => {
    const fixture = providerFixture();
    const adapter = createEip1193WalletAdapter(fixture.provider);
    fixture.state.accounts = [];
    expect(await adapter.getSession()).toBeNull();
    expect(fixture.requestRpc.mock.calls.map(([call]) => call.method)).toEqual(['eth_accounts']);
    fixture.state.accounts = [ACCOUNT];
    expect(await adapter.connect()).toEqual({ account: ACCOUNT, chainId: 1 });
    expect(fixture.requestRpc.mock.calls.map(([call]) => call.method)).toEqual(['eth_accounts', 'eth_requestAccounts', 'eth_accounts', 'eth_chainId']);
  });

  it('refreshes account and chain before every send and pins both in the RPC request', async () => {
    const fixture = providerFixture();
    const adapter = createEip1193WalletAdapter(fixture.provider);
    await adapter.connect();
    fixture.requestRpc.mockClear();
    expect(await adapter.sendTransaction(request)).toBe(HASH);
    expect(fixture.requestRpc.mock.calls.map(([call]) => call.method)).toEqual(['eth_accounts', 'eth_chainId', 'eth_sendTransaction']);
    expect(fixture.requestRpc).toHaveBeenLastCalledWith({ method: 'eth_sendTransaction', params: [{ from: ACCOUNT, chainId: '0x1', to: TO, data: '0xabcd', value: '0x9' }] });
    fixture.state.accounts = [OTHER_ACCOUNT, ACCOUNT];
    await expect(adapter.sendTransaction(request)).rejects.toThrow('account changed');
    fixture.state.accounts = [ACCOUNT];
    fixture.state.chain = '0x2';
    await expect(adapter.sendTransaction(request)).rejects.toThrow('chain changed');
    fixture.state.accounts = [];
    await expect(adapter.sendTransaction(request)).rejects.toThrow('Connect a wallet');
    expect(fixture.requestRpc.mock.calls.filter(([call]) => call.method === 'eth_sendTransaction')).toHaveLength(1);
    expect(fixture.requestRpc.mock.calls.some(([call]) => call.method === 'wallet_switchEthereumChain')).toBe(false);
  });

  it('switches only when requested and verifies the resulting chain', async () => {
    const fixture = providerFixture();
    const adapter = createEip1193WalletAdapter(fixture.provider);
    await adapter.switchChain(137);
    expect(await adapter.getSession()).toEqual({ account: ACCOUNT, chainId: 137 });
    expect(fixture.requestRpc).toHaveBeenCalledWith({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x89' }] });
    fixture.state.switchIgnored = true;
    await expect(adapter.switchChain(1)).rejects.toThrow('did not switch');
    await expect(adapter.switchChain(0)).rejects.toThrow('chain ID');
  });

  it('propagates wallet rejection without retrying or requesting another action', async () => {
    const fixture = providerFixture();
    const adapter = createEip1193WalletAdapter(fixture.provider);
    const rejected = Object.assign(new Error('User declined'), { code: 4001 });
    fixture.state.rejected = rejected;
    await expect(adapter.connect()).rejects.toBe(rejected);
    await expect(adapter.sendTransaction(request)).rejects.toBe(rejected);
    await expect(adapter.switchChain(2)).rejects.toBe(rejected);
    expect(fixture.requestRpc.mock.calls.filter(([call]) => call.method === 'eth_sendTransaction')).toHaveLength(1);
  });

  it('does not submit malformed inputs and refuses malformed provider results', async () => {
    const fixture = providerFixture();
    const adapter = createEip1193WalletAdapter(fixture.provider);
    await expect(adapter.sendTransaction({ ...request, data: '0xabc' })).rejects.toThrow('calldata');
    await expect(adapter.sendTransaction({ ...request, account: '0x12' })).rejects.toThrow('address');
    await expect(adapter.sendTransaction({ ...request, value: -1n })).rejects.toThrow('nonnegative');
    expect(fixture.requestRpc).not.toHaveBeenCalled();
    fixture.state.accounts = ['0x12'];
    await expect(adapter.getSession()).rejects.toThrow('address');
    fixture.state.accounts = [ACCOUNT];
    fixture.state.chain = '1';
    await expect(adapter.getSession()).rejects.toThrow('chain ID');
    fixture.state.chain = '0x1';
    fixture.state.sentHash = '0x12';
    await expect(adapter.sendTransaction(request)).rejects.toThrow('transaction hash');
  });

  it('subscribes to session changes and removes only its own listeners', () => {
    const fixture = providerFixture();
    const adapter = createEip1193WalletAdapter(fixture.provider);
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribe = adapter.subscribe!(first);
    adapter.subscribe!(second);
    for (const callback of fixture.listeners.get('accountsChanged')!) callback();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    unsubscribe();
    for (const event of ['accountsChanged', 'chainChanged', 'connect', 'disconnect']) {
      for (const callback of fixture.listeners.get(event)!) callback();
    }
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(5);
  });

  it('returns null with no injected wallet, during SSR, or with blocked injection access', () => {
    vi.stubGlobal('window', undefined);
    expect(getInjectedSoothWallet()).toBeNull();
    vi.stubGlobal('window', {});
    expect(getInjectedSoothWallet()).toBeNull();
    vi.stubGlobal('window', { ethereum: { request: 1 } });
    expect(getInjectedSoothWallet()).toBeNull();
    vi.stubGlobal('window', { get ethereum() { throw new Error('Blocked'); } });
    expect(getInjectedSoothWallet()).toBeNull();
    const fixture = providerFixture();
    vi.stubGlobal('window', { ethereum: fixture.provider });
    expect(getInjectedSoothWallet()).not.toBeNull();
    expect(fixture.requestRpc).not.toHaveBeenCalled();
  });
});

describe('viem wallet adapter', () => {
  it('uses live transport sessions and sends on an explicitly switched chain despite stale client configuration', async () => {
    const fixture = providerFixture();
    const wallet = createWalletClient({ chain: mainnet, account: ACCOUNT, dataSuffix: '0xffff', transport: custom(fixture.provider, { retryCount: 0 }) });
    const adapter = createViemWalletAdapter(wallet);
    expect(await adapter.connect()).toEqual({ account: ACCOUNT, chainId: 1 });
    await adapter.switchChain(137);
    expect(wallet.chain.id).toBe(1);
    expect(await adapter.sendTransaction({ ...request, chainId: 137 })).toBe(HASH);
    // viem's custom transport also forwards an optional request-options argument.
    expect(fixture.requestRpc.mock.lastCall?.[0]).toEqual({ method: 'eth_sendTransaction', params: [{ from: ACCOUNT, chainId: '0x89', to: TO, data: '0xabcd', value: '0x9' }] });
    fixture.state.accounts = [OTHER_ACCOUNT];
    await expect(adapter.sendTransaction({ ...request, chainId: 137 })).rejects.toThrow('account changed');
    fixture.state.accounts = [ACCOUNT];
    fixture.state.chain = '0x1';
    await expect(adapter.sendTransaction({ ...request, chainId: 137 })).rejects.toThrow('chain changed');
    expect(fixture.requestRpc.mock.calls.filter(([call]) => call.method === 'eth_sendTransaction')).toHaveLength(1);
  });

  it('reads disconnected sessions without requesting wallet access', async () => {
    const fixture = providerFixture();
    fixture.state.accounts = [];
    const adapter = createViemWalletAdapter(createWalletClient({ transport: custom(fixture.provider, { retryCount: 0 }) }));
    expect(await adapter.getSession()).toBeNull();
    expect(fixture.requestRpc.mock.calls.map(([call]) => call.method)).toEqual(['eth_accounts']);
    await expect(adapter.connect()).rejects.toThrow('Connect a wallet');
  });

  it('preserves a local account signer and pins chain and calldata without requesting RPC accounts', async () => {
    const account = privateKeyToAccount(`0x${'11'.repeat(32)}`);
    const sendTransaction = vi.fn(async () => HASH);
    const requestAddresses = vi.fn();
    const wallet = { account, chain: mainnet, getAddresses: vi.fn(async () => [account.address]), getChainId: vi.fn(async () => 1), sendTransaction, requestAddresses } as unknown as WalletClient;
    const adapter = createViemWalletAdapter(wallet);
    expect(await adapter.connect()).toEqual({ account: account.address.toLowerCase(), chainId: 1 });
    expect(requestAddresses).not.toHaveBeenCalled();
    expect(await adapter.sendTransaction({ ...request, account: account.address })).toBe(HASH);
    expect(sendTransaction).toHaveBeenCalledWith({ ...request, account, chain: mainnet, dataSuffix: '0x' });
  });
});

describe('pending transaction storage', () => {
  it('scopes by the full market reference and preserves the account on every record', () => {
    storageFixture();
    const first = pendingRecord();
    const otherAccount = pendingRecord({ account: OTHER_ACCOUNT, hash: OTHER_HASH });
    const book = pendingRecord({ market: MARKET.replace(/:amm$/, ':book') });
    const release = pendingRecord({ market: MARKET.replace(`:${OTHER_HASH}:amm`, `:${HASH}:amm`) });
    for (const record of [first, otherAccount, book, release]) expect(saveSoothPending(record)).toBe(true);
    expect(loadSoothPending(MARKET)).toEqual([first, otherAccount]);
    expect(loadSoothPending(book.market)).toEqual([book]);
    expect(loadSoothPending(release.market)).toEqual([release]);
    removeSoothPending(MARKET, HASH);
    expect(loadSoothPending(MARKET)).toEqual([otherAccount]);
    expect(loadSoothPending(book.market)).toEqual([book]);
    expect(loadSoothPending(release.market)).toEqual([release]);
  });

  it('normalizes hex casing and updates only a matching market, account and hash', () => {
    storageFixture();
    const uppercase = (value: string) => `0x${value.slice(2).toUpperCase()}`;
    const mixed = pendingRecord({ market: MARKET.replace(TO, uppercase(TO)), account: uppercase(ACCOUNT) as Address, hash: uppercase(HASH) as Hash, to: uppercase(TO) as Address, data: '0xABCD' });
    expect(saveSoothPending(mixed)).toBe(true);
    expect(loadSoothPending(MARKET)).toEqual([pendingRecord()]);
    expect(saveSoothPending(pendingRecord({ label: 'Approval' }))).toBe(true);
    expect(saveSoothPending(pendingRecord({ account: OTHER_ACCOUNT }))).toBe(true);
    expect(loadSoothPending(MARKET)).toEqual([pendingRecord({ label: 'Approval' }), pendingRecord({ account: OTHER_ACCOUNT })]);
  });

  it.each([
    ['short hash', { hash: '0xab' }],
    ['nonhex hash', { hash: `0x${'gg'.repeat(32)}` }],
    ['short account', { account: '0xab' }],
    ['zero account', { account: `0x${'00'.repeat(20)}` }],
    ['short destination', { to: '0xab' }],
    ['odd calldata', { data: '0xabc' }],
    ['nonhex calldata', { data: '0xzz' }],
    ['partial reference', { market: TO }],
    ['missing release and venue', { market: MARKET.split(':').slice(0, 7).join(':') }],
    ['noncanonical chain reference', { market: MARKET.replace(':v1:1:', ':v1:01:') }],
    ['mismatched chain', { chainId: 2 }],
    ['fractional chain', { chainId: 1.5 }],
    ['unsafe chain', { chainId: Number.MAX_SAFE_INTEGER + 1 }],
    ['future version', { version: 2 }],
    ['invalid timestamp', { submittedAt: -1 }],
    ['fractional timestamp', { submittedAt: 1.5 }],
    ['invalid label', { label: 7 }],
  ])('ignores %s without deleting persisted data', (_description, invalid) => {
    const store = storageFixture();
    expect(saveSoothPending(pendingRecord())).toBe(true);
    const key = store.key(0)!;
    const raw = { ...pendingRecord(), ...invalid };
    store.setItem(key, JSON.stringify([raw]));
    vi.stubGlobal('window', { localStorage: store });
    expect(loadSoothPending(MARKET)).toEqual([]);
    expect(saveSoothPending(raw as SoothPendingTransaction)).toBe(false);
    expect(JSON.parse(store.getItem(key)!)).toEqual([raw]);
  });

  it('preserves old, unknown-version, malformed and out-of-scope entries during writes and removals', () => {
    const store = storageFixture();
    const old = pendingRecord({ submittedAt: 0 });
    expect(saveSoothPending(old)).toBe(true);
    const key = store.key(0)!;
    const future = { ...pendingRecord(), version: 2, futureData: 'retain me' };
    const unrelated = pendingRecord({ market: MARKET.replace(/:amm$/, ':book') });
    const unknown = [future, { hash: OTHER_HASH }, unrelated];
    store.setItem(key, JSON.stringify([old, ...unknown]));
    expect(loadSoothPending(MARKET)).toEqual([old]);
    expect(saveSoothPending(pendingRecord({ hash: OTHER_HASH }))).toBe(true);
    removeSoothPending(MARKET, HASH);
    expect(loadSoothPending(MARKET)).toEqual([pendingRecord({ hash: OTHER_HASH })]);
    expect(JSON.parse(store.getItem(key)!)).toEqual([...unknown, pendingRecord({ hash: OTHER_HASH })]);
    removeSoothPending(MARKET, OTHER_HASH);
    expect(JSON.parse(store.getItem(key)!)).toEqual(unknown);
  });

  it('does not overwrite corrupt or unknown storage envelopes', () => {
    const store = storageFixture();
    saveSoothPending(pendingRecord());
    const key = store.key(0)!;
    for (const raw of ['{broken', '{"version":2,"transactions":[]}']) {
      store.setItem(key, raw);
      vi.stubGlobal('window', { localStorage: store });
      expect(loadSoothPending(MARKET)).toEqual([]);
      expect(saveSoothPending(pendingRecord())).toBe(false);
      removeSoothPending(MARKET, HASH);
      expect(store.getItem(key)).toBe(raw);
    }
  });

  it('probes durable storage without changing existing records or leaving a probe entry', () => {
    const store = storageFixture();
    saveSoothPending(pendingRecord());
    const before = [...store.entries];
    expect(canPersistSoothPending()).toBe(true);
    expect([...store.entries]).toEqual(before);
  });

  it('fails the durability probe when storage is absent, blocked, silently discards writes, or cannot remove', () => {
    const blocked = () => { throw new Error('Storage blocked'); };
    for (const candidate of [undefined, {}, { get localStorage() { return blocked(); } }]) {
      vi.stubGlobal('window', candidate);
      expect(canPersistSoothPending()).toBe(false);
    }
    for (const method of ['getItem', 'setItem', 'removeItem'] as const) {
      const store = storageFixture();
      vi.spyOn(store, method).mockImplementation(blocked);
      expect(canPersistSoothPending()).toBe(false);
    }
    const discard = storageFixture();
    vi.spyOn(discard, 'setItem').mockImplementation(() => {});
    expect(canPersistSoothPending()).toBe(false);
    const retain = storageFixture();
    vi.spyOn(retain, 'removeItem').mockImplementation(() => {});
    expect(canPersistSoothPending()).toBe(false);
  });

  it('cleans up the probe after a mismatched read and never overwrites a collided key', () => {
    const mismatch = storageFixture();
    vi.spyOn(mismatch, 'getItem').mockReturnValueOnce(null).mockReturnValue('different');
    expect(canPersistSoothPending()).toBe(false);
    expect(mismatch.length).toBe(0);
    const collision = storageFixture();
    vi.spyOn(collision, 'getItem').mockReturnValue('existing');
    const set = vi.spyOn(collision, 'setItem');
    const remove = vi.spyOn(collision, 'removeItem');
    expect(canPersistSoothPending()).toBe(false);
    expect(set).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('is safe during SSR and when storage getters or operations are blocked', () => {
    const blocked = () => { throw new Error('Storage blocked'); };
    const windows = [undefined, {}, { get localStorage() { return blocked(); } }, { localStorage: { getItem: blocked, setItem: blocked, removeItem: blocked } }];
    for (const candidate of windows) {
      vi.stubGlobal('window', candidate);
      expect(loadSoothPending(MARKET)).toEqual([]);
      expect(saveSoothPending(pendingRecord())).toBe(false);
      expect(loadSoothPending(MARKET)).toEqual(candidate === undefined ? [] : [pendingRecord()]);
      expect(() => removeSoothPending(MARKET, HASH)).not.toThrow();
      expect(loadSoothPending(MARKET)).toEqual([]);
    }
    const store = storageFixture();
    saveSoothPending(pendingRecord());
    vi.spyOn(store, 'setItem').mockImplementation(blocked);
    expect(saveSoothPending(pendingRecord({ hash: OTHER_HASH }))).toBe(false);
    expect(loadSoothPending(MARKET)).toEqual([pendingRecord({ hash: OTHER_HASH }), pendingRecord()]);
    vi.spyOn(store, 'removeItem').mockImplementation(blocked);
    expect(() => removeSoothPending(MARKET, HASH)).not.toThrow();
    expect(loadSoothPending(MARKET)).toEqual([pendingRecord({ hash: OTHER_HASH }), pendingRecord()]);
  });

  it('shares nondurable pending across callers only within the same document and isolates returned records', () => {
    vi.stubGlobal('window', {});
    const pending = pendingRecord();
    expect(saveSoothPending(pending)).toBe(false);
    const firstWidget = loadSoothPending(MARKET);
    const secondWidget = loadSoothPending(MARKET);
    expect(secondWidget).toEqual([pending]);
    firstWidget[0].label = 'Changed by consumer';
    expect(loadSoothPending(MARKET)).toEqual([pending]);
    expect(loadSoothPending(MARKET.replace(/:amm$/, ':book'))).toEqual([]);
    removeSoothPending(MARKET, HASH);
    expect(loadSoothPending(MARKET)).toEqual([]);
    saveSoothPending(pending);
    vi.stubGlobal('window', {});
    expect(loadSoothPending(MARKET)).toEqual([]);
  });

  it('reads writes and removals from another document without resurrecting a durable local cache', () => {
    const store = new MemoryStorage();
    const firstWindow = { localStorage: store };
    const secondWindow = { localStorage: store };
    vi.stubGlobal('window', secondWindow);
    expect(loadSoothPending(MARKET)).toEqual([]);
    vi.stubGlobal('window', firstWindow);
    expect(saveSoothPending(pendingRecord())).toBe(true);
    vi.stubGlobal('window', secondWindow);
    expect(canPersistSoothPending()).toBe(true);
    expect(loadSoothPending(MARKET)).toEqual([pendingRecord()]);
    removeSoothPending(MARKET, HASH);
    vi.stubGlobal('window', firstWindow);
    expect(loadSoothPending(MARKET)).toEqual([]);
  });

  it('retires nondurable memory after a successful retry so remote removal stays authoritative', () => {
    const store = new MemoryStorage();
    const firstWindow = { localStorage: store };
    const secondWindow = { localStorage: store };
    vi.stubGlobal('window', firstWindow);
    const set = vi.spyOn(store, 'setItem').mockImplementationOnce(() => { throw new Error('Quota exceeded'); });
    expect(saveSoothPending(pendingRecord())).toBe(false);
    expect(loadSoothPending(MARKET)).toEqual([pendingRecord()]);
    set.mockRestore();
    expect(saveSoothPending(pendingRecord())).toBe(true);
    vi.stubGlobal('window', secondWindow);
    removeSoothPending(MARKET, HASH);
    vi.stubGlobal('window', firstWindow);
    expect(loadSoothPending(MARKET)).toEqual([]);
  });

  it('reports silently discarded writes as nondurable and preserves their local recovery record', () => {
    const store = storageFixture();
    vi.spyOn(store, 'setItem').mockImplementation(() => {});
    expect(saveSoothPending(pendingRecord())).toBe(false);
    expect(loadSoothPending(MARKET)).toEqual([pendingRecord()]);
    vi.stubGlobal('window', { localStorage: store });
    expect(loadSoothPending(MARKET)).toEqual([]);
  });
});

describe('pending transaction reconciliation', () => {
  it.each(['success', 'reverted'] as const)('returns terminal %s only for matching receipt and transaction, leaving removal to the caller', async status => {
    storageFixture();
    const fixture = publicClientFixture();
    const pending = pendingRecord();
    fixture.receipt.status = status;
    saveSoothPending(pending);
    expect(await reconcileSoothPending(fixture.client, pending)).toEqual({ status: status === 'success' ? 'confirmed' : 'failed', receipt: fixture.receipt });
    expect(fixture.getTransactionReceipt).toHaveBeenCalledWith({ hash: HASH });
    expect(fixture.getTransaction).toHaveBeenCalledWith({ hash: HASH });
    expect(fixture.getBlock).toHaveBeenCalledWith({ blockNumber: 4n });
    expect(loadSoothPending(MARKET)).toEqual([pending]);
    removeSoothPending(MARKET, HASH);
    expect(loadSoothPending(MARKET)).toEqual([]);
  });

  it('treats missing receipt or transaction, including wrapped RPC errors, as still pending', async () => {
    storageFixture();
    const pending = pendingRecord();
    saveSoothPending(pending);
    const receiptMissing = publicClientFixture();
    receiptMissing.getTransactionReceipt.mockRejectedValue(new TransactionReceiptNotFoundError({ hash: HASH }));
    expect(await reconcileSoothPending(receiptMissing.client, pending)).toEqual({ status: 'pending' });
    const transactionMissing = publicClientFixture();
    transactionMissing.getTransaction.mockRejectedValue(new BaseError('RPC source has not indexed the transaction', { cause: new TransactionNotFoundError({ hash: HASH }) }));
    expect(await reconcileSoothPending(transactionMissing.client, pending)).toEqual({ status: 'pending' });
    expect(loadSoothPending(MARKET)).toEqual([pending]);
  });

  it.each([
    ['transactionHash', OTHER_HASH], ['to', OTHER_ACCOUNT], ['from', OTHER_ACCOUNT], ['to', null], ['blockHash', HASH], ['blockNumber', 5n],
  ])('rejects receipt %s mismatch', async (field, value) => {
    const fixture = publicClientFixture();
    Object.assign(fixture.receipt, { [field]: value });
    await expect(reconcileSoothPending(fixture.client, pendingRecord())).rejects.toBeInstanceOf(FactoryTransactionIdentityError);
  });

  it.each([
    ['hash', OTHER_HASH], ['to', OTHER_ACCOUNT], ['from', OTHER_ACCOUNT], ['input', '0xabce'], ['input', '0xabcd00'], ['chainId', 2], ['to', null], ['value', 1n], ['blockHash', HASH], ['blockNumber', 5n],
  ])('rejects transaction %s mismatch', async (field, value) => {
    const fixture = publicClientFixture();
    Object.assign(fixture.transaction, { [field]: value });
    await expect(reconcileSoothPending(fixture.client, pendingRecord())).rejects.toBeInstanceOf(FactoryTransactionIdentityError);
  });

  it('keeps a record pending until both transaction and receipt evidence are available', async () => {
    const fixture = publicClientFixture();
    fixture.getTransactionReceipt.mockRejectedValue(new TransactionReceiptNotFoundError({ hash: HASH }));
    expect(await reconcileSoothPending(fixture.client, pendingRecord())).toEqual({ status: 'pending' });
    expect(fixture.getBlock).not.toHaveBeenCalled();
  });

  it('keeps missing canonical blocks pending and rejects receipts from a replaced block', async () => {
    const missing = publicClientFixture();
    missing.getBlock.mockRejectedValue(new BaseError('RPC block unavailable', { cause: new BlockNotFoundError({ blockNumber: 4n }) }));
    expect(await reconcileSoothPending(missing.client, pendingRecord())).toEqual({ status: 'pending' });
    const replaced = publicClientFixture();
    replaced.block.hash = HASH;
    await expect(reconcileSoothPending(replaced.client, pendingRecord())).rejects.toBeInstanceOf(FactoryTransactionIdentityError);
    replaced.block.hash = null;
    await expect(reconcileSoothPending(replaced.client, pendingRecord())).rejects.toBeInstanceOf(FactoryTransactionIdentityError);
  });

  it.each([0n, 5n, 50n])('accepts wallet-edited approval grant amount %s while preserving recovery until explicit removal', async amount => {
    storageFixture();
    const fixture = publicClientFixture();
    const pending = pendingRecord({ data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [OTHER_ACCOUNT, 10n] }) });
    fixture.transaction.input = encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [OTHER_ACCOUNT, amount] });
    saveSoothPending(pending);
    expect((await reconcileSoothPending(fixture.client, pending)).status).toBe('confirmed');
    expect(loadSoothPending(MARKET)).toEqual([pending]);
  });

  it('requires an original zero-allowance reset to remain exactly zero', async () => {
    const fixture = publicClientFixture();
    const pending = pendingRecord({ data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [OTHER_ACCOUNT, 0n] }) });
    fixture.transaction.input = encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [OTHER_ACCOUNT, 1n] });
    await expect(reconcileSoothPending(fixture.client, pending)).rejects.toBeInstanceOf(FactoryTransactionIdentityError);
    fixture.transaction.input = pending.data;
    expect((await reconcileSoothPending(fixture.client, pending)).status).toBe('confirmed');
  });

  it.each(['spender', 'token', 'selector', 'account', 'chain', 'trailing bytes'])('rejects wallet-edited approval %s identity', async field => {
    const fixture = publicClientFixture();
    const pending = pendingRecord({ data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [OTHER_ACCOUNT, 10n] }) });
    fixture.transaction.input = encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [OTHER_ACCOUNT, 50n] });
    if (field === 'spender') fixture.transaction.input = encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [ACCOUNT, 50n] });
    if (field === 'token') { fixture.transaction.to = OTHER_ACCOUNT; fixture.receipt.to = OTHER_ACCOUNT; }
    if (field === 'selector') fixture.transaction.input = encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [OTHER_ACCOUNT, 50n] });
    if (field === 'account') { fixture.transaction.from = OTHER_ACCOUNT; fixture.receipt.from = OTHER_ACCOUNT; }
    if (field === 'chain') fixture.transaction.chainId = 2;
    if (field === 'trailing bytes') fixture.transaction.input += '00';
    await expect(reconcileSoothPending(fixture.client, pending)).rejects.toBeInstanceOf(FactoryTransactionIdentityError);
  });

  it('matches hex identity regardless of casing', async () => {
    const fixture = publicClientFixture();
    const uppercase = (value: string) => `0x${value.slice(2).toUpperCase()}`;
    Object.assign(fixture.receipt, { transactionHash: uppercase(HASH), from: uppercase(ACCOUNT), to: uppercase(TO) });
    Object.assign(fixture.transaction, { hash: uppercase(HASH), from: uppercase(ACCOUNT), to: uppercase(TO), input: '0xABCD' });
    expect((await reconcileSoothPending(fixture.client, pendingRecord())).status).toBe('confirmed');
  });

  it('rejects a wrong RPC chain before looking up a receipt', async () => {
    const fixture = publicClientFixture();
    fixture.getChainId.mockResolvedValue(2);
    await expect(reconcileSoothPending(fixture.client, pendingRecord())).rejects.toThrow('RPC chain');
    expect(fixture.getTransactionReceipt).not.toHaveBeenCalled();
    expect(fixture.getTransaction).not.toHaveBeenCalled();
  });

  it('propagates non-not-found RPC failures without deleting pending evidence', async () => {
    storageFixture();
    saveSoothPending(pendingRecord());
    const fixture = publicClientFixture();
    const unavailable = new Error('RPC unavailable');
    fixture.getTransaction.mockRejectedValue(unavailable);
    await expect(reconcileSoothPending(fixture.client, pendingRecord())).rejects.toBe(unavailable);
    expect(loadSoothPending(MARKET)).toEqual([pendingRecord()]);
  });
});
