import { describe, expect, it, vi } from 'vitest';
import type { PublicClient, TransactionReceipt } from 'viem';
import { commandAction, integerAmount, parseAction, parseCliArgs, parseRelease } from '../../src/cli/arguments.js';
import { inspectReceipt, runCli, type CliIO } from '../../src/cli/index.js';
import type { FactoryTransactionRequest } from '../../src/factory/factoryTransactions.js';

const account = '0x1111111111111111111111111111111111111111';
const target = '0x2222222222222222222222222222222222222222';
const hash = `0x${'a'.repeat(64)}` as const;
const blockHash = `0x${'b'.repeat(64)}` as const;
function output() {
  const stdout: string[] = [], stderr: string[] = [];
  const io: CliIO = { stdout: text => { stdout.push(text); }, stderr: text => { stderr.push(text); }, readJson: vi.fn(), env: vi.fn() };
  return { stdout, stderr, io };
}

describe('CLI command safety', () => {
  it('defaults to preparation and does not load a wallet for help or invalid commands', async () => {
    expect(parseCliArgs(['trade']).flags.send).toBeUndefined();
    const result = output();
    expect(await runCli(['--help'], result.io)).toBe(0);
    expect(await runCli(['trade', '--send', '--private-key', 'secret'], result.io)).toBe(1);
    expect(result.io.env).not.toHaveBeenCalled();
    expect(result.stderr.join('')).not.toContain('secret');
  });
  it.each(['actions', 'nodes', 'markets', 'identity', 'read', 'quote', 'prepare'])('refuses sending from read-only %s', command => {
    expect(() => parseCliArgs([command, '--send'])).toThrow('read-only');
  });
  it('requires explicit sending for wallet selection and separates recovery', () => {
    expect(() => parseCliArgs(['trade', '--wallet-env', 'LOCAL_KEY'])).toThrow('require --send');
    expect(() => parseCliArgs(['action', '--send', '--receipt', hash])).toThrow('separate operations');
    expect(() => parseCliArgs(['read', '--receipt', hash])).toThrow('Use action');
  });
  it('reports an unsupported release before touching RPC or wallet', async () => {
    const result = output();
    result.io.readJson = async () => ({ interfaceVersion: 'sooth-factory-v99' });
    expect(await runCli(['action', '--chain', '1', '--factory', target, '--release', 'release.json'], result.io)).toBe(1);
    expect(JSON.parse(result.stderr[0]!).status).toBe('error');
    expect(result.io.env).not.toHaveBeenCalled();
    expect(() => parseRelease({ interfaceVersion: 'sooth-factory-v99' })).toThrow('Unsupported');
  });
  it('prints supported action inputs without configuration or wallet access', async () => {
    const result = output();
    expect(await runCli(['actions'], result.io)).toBe(0);
    expect(JSON.parse(result.stdout[0]!).actions.createMarket.params.maxInputNative).toBe('uint');
    expect(result.io.readJson).not.toHaveBeenCalled();
    expect(result.io.env).not.toHaveBeenCalled();
  });
});

describe('CLI exact-unit action inputs', () => {
  it('retains native six-decimal budgets and WAD shares without numerical coercion', () => {
    const action = commandAction('book', {
      outcome: 1, action: 0, priceTick: 500, amount: '1000000000000000000', matchLimit: 16,
      validUntil: '2000000000', expiry: '2000000060', rest: true, postOnly: false,
      maxTokenIn: '510001', minTokenOut: '0',
    }, 'book');
    expect(action).toMatchObject({ kind: 'placeOrder', order: { amount: 10n ** 18n, maxTokenIn: 510001n } });
    expect(commandAction('trade', { outcome: 0, deltaShares: '-1000000000000000000', boundWad: '490000000000000000' }, 'amm')).toEqual({ kind: 'trade', outcome: 0, deltaShares: -(10n ** 18n), boundWad: 490000000000000000n });
  });
  it('rejects imprecise, missing and unlimited amounts', () => {
    for (const amount of [1000000000000000000, '1e18', '1.5', '-1', (2n ** 256n - 1n).toString()]) {
      expect(() => integerAmount(amount, 'amount')).toThrow();
    }
    expect(() => parseAction({ kind: 'trade', outcome: 1, deltaShares: '1' }, 'amm')).toThrow('boundWad');
    expect(() => parseAction({ kind: 'approve', venue: 'amm', amountNative: (2n ** 256n - 1n).toString() }, 'amm')).toThrow('bounded');
    expect(() => parseAction({ kind: 'split', amountWad: '1', maxTokenIn: '1', validUntil: (2n ** 64n - 1n).toString() }, 'book')).toThrow('finite uint64');
  });
  it('keeps venue spender selection exact and refuses arbitrary contract calls', () => {
    expect(() => parseAction({ kind: 'approve', venue: 'book', amountNative: '1' }, 'amm')).toThrow('venue');
    expect(() => commandAction('trade', { outcome: 1, deltaShares: '1', boundWad: '1' }, 'book')).toThrow('venue');
    expect(() => parseAction({ kind: 'call', to: target, data: '0x' }, 'book')).toThrow('Unsupported');
    expect(() => parseAction({ kind: 'claimDeferred', to: target }, 'book')).toThrow('Unknown');
  });
  it('supports bounded creation approval, cancellation, settlement and claims', () => {
    expect(parseAction({ kind: 'approveCreation', tokenA: target, amountNative: '1000001' }, 'amm')).toEqual({ kind: 'approveCreation', tokenA: target, amountNative: 1000001n });
    expect(commandAction('cancel', { orderId: '9007199254740993' }, 'book')).toEqual({ kind: 'cancelOrder', orderId: 9007199254740993n });
    expect(commandAction('settle', undefined, 'book')).toEqual({ kind: 'settlePosition', venue: 'book' });
    expect(commandAction('claim', { kind: 'claimAvailable', positionId: '2', units: '500000000000000000' }, 'amm')).toEqual({ kind: 'claimAvailable', positionId: 2n, units: 500000000000000000n });
  });
  it('preserves creator and report commitments and bounds swarm transport fields', () => {
    const acceptance = { kind: 'acceptMandate', adjudicator: target, creator: account, sqfHash: hash, deadline: '2000000000', jobId: blockHash, reportHash: hash };
    expect(parseAction(acceptance, 'amm')).toEqual({ ...acceptance, deadline: 2000000000n });
    expect(() => parseAction({ ...acceptance, deadline: ((1n << 64n) - 1n).toString() }, 'amm')).toThrow('finite uint64');
    expect(() => parseAction({ ...acceptance, deadline: '0' }, 'amm')).toThrow('finite uint64');
    expect(() => parseAction({ ...acceptance, creator: undefined }, 'amm')).toThrow();
    const judgment = { kind: 'recordJudgment', outcome: 2, jobId: blockHash, reportHash: hash };
    expect(parseAction(judgment, 'book')).toEqual(judgment);
    expect(() => parseAction({ ...judgment, outcome: 3 }, 'book')).toThrow('outcome');
    expect(() => parseAction({ ...judgment, jobId: '2a7594d2-92d3-4ffa-b40b-ebc8a29d5c1d' }, 'book')).toThrow();
  });
});

describe('CLI mined transaction correlation', () => {
  const request = { chainId: 31337, account, to: target, data: '0x1234', value: 0n, abi: [] } as unknown as FactoryTransactionRequest;
  const receipt = { transactionHash: hash, from: account, to: target, blockHash, blockNumber: 42n, status: 'success', logs: [] } as unknown as TransactionReceipt;
  const transaction = { hash, chainId: 31337, from: account, to: target, input: '0x1234', value: 0n, blockHash, blockNumber: 42n };
  const chainReads = { getChainId: async () => 31337, getBlock: async () => ({ hash: blockHash, number: 42n }) };
  it('returns the genuine receipt only after matching chain, sender, destination, calldata and block', async () => {
    const getTransaction = vi.fn(async () => transaction);
    const result = await inspectReceipt({ ...chainReads, getTransaction } as unknown as PublicClient, hash, request, receipt);
    expect(result.receipt).toBe(receipt);
    expect(getTransaction).toHaveBeenCalledWith({ hash });
  });
  it.each([{ chainId: 1 }, { input: '0x5678' }, { value: 1n }, { from: target }, { blockHash: hash }])('rejects an unrelated mined transaction', async mismatch => {
    const client = { ...chainReads, getTransaction: async () => ({ ...transaction, ...mismatch }) } as unknown as PublicClient;
    await expect(inspectReceipt(client, hash, request, receipt)).rejects.toThrow('does not match');
  });
  it('rejects mismatched receipt identity', async () => {
    const client = { ...chainReads, getTransaction: async () => transaction } as unknown as PublicClient;
    await expect(inspectReceipt(client, hash, request, { ...receipt, from: target })).rejects.toThrow('does not match');
  });
  it('rejects a receipt from an orphaned block', async () => {
    const client = { ...chainReads, getTransaction: async () => transaction, getBlock: async () => ({ hash, number: 42n }) } as unknown as PublicClient;
    await expect(inspectReceipt(client, hash, request, receipt)).rejects.toThrow('canonical chain');
  });
});
