import { encodeAbiParameters, encodeEventTopics, encodeFunctionData, erc20Abi, maxUint256, type Block, type Hex, type Transaction, type TransactionReceipt } from 'viem';
import { describe, expect, it } from 'vitest';
import { assertFactoryTransactionReceipt, decodeFactoryReceiptEvents, FactoryTransactionIdentityError, type FactoryReceiptIntent } from '../../src/factory/factoryReceipt.js';
import type { FactoryNodeContext } from '../../src/factory/factoryClient.js';
import { getFactoryAbis } from '../../src/factory/factoryAbi/index.js';
import { deriveNodeChildren } from '../../src/factory/factoryTrade/nodeChildren.js';
import { SUPPORTED_FACTORY_RELEASES } from '../../src/factory/releases.js';

const hash = `0x${'ab'.repeat(32)}` as const;
const blockHash = `0x${'cd'.repeat(32)}` as const;
const otherHash = `0x${'ef'.repeat(32)}` as const;
const expected = {
  chainId: 46630,
  account: '0x1111111111111111111111111111111111111111',
  to: '0x2222222222222222222222222222222222222222',
  data: '0x1234',
  value: 0n,
} satisfies FactoryReceiptIntent;
const transaction = {
  hash, from: expected.account, to: expected.to, input: expected.data, value: 0n,
  chainId: expected.chainId, blockHash, blockNumber: 5n,
} satisfies Partial<Transaction>;
const receipt = {
  transactionHash: hash, from: expected.account, to: expected.to,
  blockHash, blockNumber: 5n, status: 'success',
} satisfies Partial<TransactionReceipt>;
const block = { hash: blockHash, number: 5n } satisfies Partial<Block>;

// These are normalized viem fields. Wallet-specific RPC parsing remains in the wallet adapter.
describe('assertFactoryTransactionReceipt', () => {
  it('accepts the exact request on its canonical chain, including a reverted receipt', () => {
    expect(() => assertFactoryTransactionReceipt(expected, hash, expected.chainId, transaction, receipt, block)).not.toThrow();
    const reverted = { ...receipt, status: 'reverted' } as const;
    expect(() => assertFactoryTransactionReceipt(expected, hash, expected.chainId, transaction, reverted, block)).not.toThrow();
  });

  it('rejects a receipt read from another chain', () => {
    expect(() => assertFactoryTransactionReceipt(expected, hash, 1, transaction, receipt, block)).toThrow(FactoryTransactionIdentityError);
  });

  it.each<Partial<Transaction>>([
    { chainId: 1 }, { hash: otherHash }, { from: expected.to }, { to: expected.account },
    { to: null }, { input: '0x5678' }, { value: 1n }, { blockHash: otherHash },
    { blockNumber: 6n }, { blockHash: null }, { blockNumber: null },
  ])('rejects a different or unmined transaction %#', patch => {
    expect(() => assertFactoryTransactionReceipt(expected, hash, expected.chainId, { ...transaction, ...patch }, receipt, block)).toThrow(FactoryTransactionIdentityError);
  });

  it.each<Partial<TransactionReceipt>>([
    { transactionHash: otherHash }, { from: expected.to }, { to: expected.account },
    { to: null }, { blockHash: otherHash }, { blockNumber: 6n },
  ])('rejects a receipt that differs from the submitted request %#', patch => {
    expect(() => assertFactoryTransactionReceipt(expected, hash, expected.chainId, transaction, { ...receipt, ...patch }, block)).toThrow(FactoryTransactionIdentityError);
  });

  it.each<Partial<Block>>([
    { hash: otherHash }, { number: 6n }, { hash: null }, { number: null },
  ])('rejects a receipt outside its canonical mined block %#', patch => {
    expect(() => assertFactoryTransactionReceipt(expected, hash, expected.chainId, transaction, receipt, { ...block, ...patch })).toThrow(FactoryTransactionIdentityError);
  });

  it('matches hexadecimal bytes case-insensitively and permits a transaction without an optional chainId', () => {
    const mixedCase = { ...transaction, chainId: undefined, hash: hash.toUpperCase() as Hex, blockHash: blockHash.toUpperCase() as Hex };
    expect(() => assertFactoryTransactionReceipt(expected, hash, expected.chainId, mixedCase, receipt, block)).not.toThrow();
  });

  it('compares the supplied value rather than assuming every request sends zero', () => {
    const payable = { ...expected, value: 10n };
    expect(() => assertFactoryTransactionReceipt(payable, hash, expected.chainId, { ...transaction, value: 10n }, receipt, block)).not.toThrow();
    expect(() => assertFactoryTransactionReceipt(payable, hash, expected.chainId, transaction, receipt, block)).toThrow(FactoryTransactionIdentityError);
  });

  const spender = '0x3333333333333333333333333333333333333333' as const;
  const approval = { ...expected, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [spender, 1000n] }) };
  const policy = { allowApprovalAmountChange: true };

  it.each([0n, 10n, 2000n, maxUint256])('permits only an opted-in wallet approval amount edit to %s', amount => {
    const signed = { ...transaction, input: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [spender, amount] }) };
    expect(() => assertFactoryTransactionReceipt(approval, hash, expected.chainId, signed, receipt, block)).toThrow(FactoryTransactionIdentityError);
    expect(() => assertFactoryTransactionReceipt(approval, hash, expected.chainId, signed, receipt, block, policy)).not.toThrow();
  });

  it.each<Partial<Transaction>>([
    { input: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [expected.account, 10n] }) },
    { input: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [spender, 10n] }) },
    { to: expected.account }, { value: 1n }, { input: '0x095ea7b3' },
    { input: `${approval.data}00` },
    { input: `0x095ea7b3${'ff'.repeat(12)}${spender.slice(2)}${'0'.repeat(63)}a` },
  ])('rejects forbidden wallet approval edits %#', patch => {
    expect(() => assertFactoryTransactionReceipt(approval, hash, expected.chainId, { ...transaction, input: approval.data, ...patch }, receipt, block, policy)).toThrow(FactoryTransactionIdentityError);
  });

  it.each<Hex>(['0x095ea7b3', `${approval.data}00`])('rejects a malformed original approval %s even if the wallet preserves it', data => {
    const malformed = { ...approval, data };
    expect(() => assertFactoryTransactionReceipt(malformed, hash, expected.chainId, { ...transaction, input: approval.data }, receipt, block, policy)).toThrow(FactoryTransactionIdentityError);
    expect(() => assertFactoryTransactionReceipt(malformed, hash, expected.chainId, { ...transaction, input: data }, receipt, block, policy)).toThrow(FactoryTransactionIdentityError);
  });

  it('keeps nonapproval calldata exact when approval edits are enabled', () => {
    const transfer = { ...expected, data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [spender, 1000n] }) };
    const signed = { ...transaction, input: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [spender, 10n] }) };
    expect(() => assertFactoryTransactionReceipt(transfer, hash, expected.chainId, signed, receipt, block, policy)).toThrow(FactoryTransactionIdentityError);
  });
});

describe.each(SUPPORTED_FACTORY_RELEASES)('decodeFactoryReceiptEvents $interfaceVersion', release => {
  const context: FactoryNodeContext = {
    chainId: release.chainId, factory: release.factory, nodeId: hash, release,
    contracts: { ...deriveNodeChildren(expected.to), deployer: expected.to },
    startBlock: BigInt(release.startBlock), blockNumber: BigInt(release.startBlock + 5),
  };
  const market = '0x4444444444444444444444444444444444444444' as const;
  const abis = getFactoryAbis(release);
  const positionTraded = abis.AMMEngineAbi.find(item => item.type === 'event' && item.name === 'PositionTraded')!;
  const orderPlaced = abis.OrderEngineAbi.find(item => item.type === 'event' && item.name === 'OrderPlaced')!;
  const claimed = abis.AmmFeeVaultAbi.find(item => item.type === 'event' && item.name === 'Claimed')!;
  const logIdentity = {
    transactionHash: hash, transactionIndex: 0, blockHash,
    blockNumber: context.blockNumber, removed: false,
  };
  const tradeLog = {
    ...logIdentity, address: context.contracts.amm, logIndex: 0,
    topics: encodeEventTopics({ abi: abis.AMMEngineAbi, eventName: 'PositionTraded', args: { user: expected.account, market } }),
    data: encodeAbiParameters(positionTraded.inputs.filter(input => !input.indexed), [1, -25n, 17n, 100n, 200n]),
  };
  const orderLog = {
    ...logIdentity, address: context.contracts.book, logIndex: 1,
    topics: encodeEventTopics({ abi: abis.OrderEngineAbi, eventName: 'OrderPlaced', args: { market, maker: expected.account, orderId: 7n } }),
    data: encodeAbiParameters(orderPlaced.inputs.filter(input => !input.indexed), [0, 1, 500, 25n, 1000n, 17n]),
  };
  const claimLog = {
    ...logIdentity, address: context.contracts.ammVault, logIndex: 2,
    topics: encodeEventTopics({ abi: abis.AmmFeeVaultAbi, eventName: 'Claimed', args: { market, venue: 0, token: expected.to } }),
    data: encodeAbiParameters(claimed.inputs.filter(input => !input.indexed), [0, expected.account, 11n]),
  };
  const mined = {
    ...receipt, blockNumber: context.blockNumber, transactionIndex: 0, logs: [tradeLog, orderLog, claimLog],
  } as TransactionReceipt;

  it('returns actual fill, order and claim fields from their verified emitters', () => {
    expect(decodeFactoryReceiptEvents({ context, receipt: mined, market })).toMatchObject([
      { eventName: 'PositionTraded', address: context.contracts.amm, logIndex: 0, args: { market, user: expected.account, deltaShares: -25n, cost: 17n } },
      { eventName: 'OrderPlaced', address: context.contracts.book, logIndex: 1, args: { market, orderId: 7n, amount: 25n, cashReserved: 17n } },
      { eventName: 'Claimed', address: context.contracts.ammVault, logIndex: 2, args: { market, recipient: expected.account, amount: 11n } },
    ]);
  });

  it('ignores foreign emitters, wrong emitter ABI, malformed data and logs from another receipt', () => {
    const ignored = [
      { ...tradeLog, address: expected.account },
      { ...tradeLog, address: context.contracts.book },
      { ...tradeLog, data: '0x' as Hex },
      { ...tradeLog, removed: true },
      { ...tradeLog, blockHash: otherHash },
      { ...tradeLog, transactionHash: otherHash },
      { ...tradeLog, blockNumber: context.blockNumber + 1n },
      { ...tradeLog, transactionIndex: 1 },
    ];
    expect(decodeFactoryReceiptEvents({ context, receipt: { ...mined, logs: [...ignored, orderLog] }, market })).toMatchObject([
      { eventName: 'OrderPlaced', logIndex: 1 },
    ]);
  });

  it('scopes market arguments and never manufactures events for empty or reverted receipts', () => {
    expect(decodeFactoryReceiptEvents({ context, receipt: mined, market: expected.to })).toEqual([]);
    expect(decodeFactoryReceiptEvents({ context, receipt: { ...mined, logs: [] }, market })).toEqual([]);
    expect(decodeFactoryReceiptEvents({ context, receipt: { ...mined, status: 'reverted' }, market })).toEqual([]);
  });

  it('refuses an unpinned release and mismatched node identity', () => {
    expect(() => decodeFactoryReceiptEvents({ context: { ...context, release: { ...release, interfaceVersion: 'unrecognized' } }, receipt: mined })).toThrow();
    expect(() => decodeFactoryReceiptEvents({ context: { ...context, chainId: context.chainId + 1 }, receipt: mined })).toThrow('release mismatch');
  });
});
