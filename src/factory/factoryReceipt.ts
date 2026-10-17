import {
  decodeEventLog,
  decodeFunctionData,
  encodeFunctionData,
  erc20Abi,
  type Abi,
  type Address,
  type Block,
  type Hex,
  type Transaction,
  type TransactionReceipt,
} from 'viem';
import { getFactoryAbis } from './factoryAbi/index.js';
import type { FactoryNodeContext } from './factoryClient.js';
import { factoryAddress } from './schemaIdentity.js';

/** The prepared request, independent of wallet submission and persisted recovery state. */
export interface FactoryReceiptIntent {
  chainId: number;
  account: Address;
  to: Address;
  data: Hex;
  value: bigint;
}

export class FactoryTransactionIdentityError extends Error {
  constructor() {
    super('Confirmed transaction does not match the signed intent and canonical chain');
    this.name = 'FactoryTransactionIdentityError';
  }
}

export interface FactoryReceiptPolicy {
  /** Permit only a canonically encoded approve amount edit; the token and spender stay fixed. */
  allowApprovalAmountChange?: boolean;
}

type ReceiptTransaction = Pick<
  Transaction,
  'hash' | 'from' | 'to' | 'input' | 'value' | 'blockHash' | 'blockNumber'
> & { chainId?: number };
type ReceiptIdentity = Pick<
  TransactionReceipt,
  'transactionHash' | 'from' | 'to' | 'blockHash' | 'blockNumber'
>;

function matchesData(expected: Hex, actual: Hex, allowApprovalAmountChange: boolean): boolean {
  if (!allowApprovalAmountChange || expected.slice(0, 10).toLowerCase() !== '0x095ea7b3')
    return expected.toLowerCase() === actual.toLowerCase();
  try {
    const intent = decodeFunctionData({ abi: erc20Abi, data: expected });
    const signed = decodeFunctionData({ abi: erc20Abi, data: actual });
    if (intent.functionName !== 'approve' || signed.functionName !== 'approve') return false;
    return (
      encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: intent.args,
      }).toLowerCase() === expected.toLowerCase() &&
      encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: signed.args,
      }).toLowerCase() === actual.toLowerCase() &&
      intent.args[0].toLowerCase() === signed.args[0].toLowerCase()
    );
  } catch {
    return false;
  }
}

/**
 * Correlate a normalized viem transaction and receipt with the submitted request.
 * Read canonicalBlock by receipt.blockNumber from the client whose chainId is supplied.
 * Verify both successful and reverted receipts before clearing recovery; status, polling,
 * wallet orchestration and persistence remain the caller's responsibility.
 */
export function assertFactoryTransactionReceipt(
  expected: FactoryReceiptIntent,
  hash: Hex,
  chainId: number,
  transaction: ReceiptTransaction,
  receipt: ReceiptIdentity,
  canonicalBlock: Pick<Block, 'hash' | 'number'>,
  policy?: FactoryReceiptPolicy,
): void {
  if (
    chainId !== expected.chainId ||
    (transaction.chainId !== undefined && transaction.chainId !== expected.chainId) ||
    receipt.transactionHash.toLowerCase() !== hash.toLowerCase() ||
    transaction.hash.toLowerCase() !== hash.toLowerCase() ||
    receipt.from.toLowerCase() !== expected.account.toLowerCase() ||
    transaction.from.toLowerCase() !== expected.account.toLowerCase() ||
    receipt.to?.toLowerCase() !== expected.to.toLowerCase() ||
    transaction.to?.toLowerCase() !== expected.to.toLowerCase() ||
    transaction.value !== expected.value ||
    !matchesData(expected.data, transaction.input, policy?.allowApprovalAmountChange === true) ||
    canonicalBlock.hash === null ||
    canonicalBlock.number === null ||
    receipt.blockHash.toLowerCase() !== canonicalBlock.hash.toLowerCase() ||
    receipt.blockNumber !== canonicalBlock.number ||
    transaction.blockHash?.toLowerCase() !== receipt.blockHash.toLowerCase() ||
    transaction.blockNumber !== receipt.blockNumber
  )
    throw new FactoryTransactionIdentityError();
}

export interface FactoryReceiptEvent {
  eventName: string;
  args: Readonly<Record<string, unknown>> | readonly unknown[];
  address: Address;
  logIndex: number;
}

/** Decode actual receipt logs after identity verification, using each verified emitter's pinned ABI. */
export function decodeFactoryReceiptEvents(input: {
  context: FactoryNodeContext;
  receipt: TransactionReceipt;
  /** A market already verified against this node; also scopes named market arguments. */
  market?: Address;
}): FactoryReceiptEvent[] {
  const { context, receipt } = input;
  const abis = getFactoryAbis(context.release);
  if (
    context.chainId !== context.release.chainId ||
    factoryAddress(context.factory) !== factoryAddress(context.release.factory)
  )
    throw new Error('Receipt context release mismatch');
  if (receipt.status !== 'success' || receipt.blockNumber < context.startBlock) return [];
  const contracts = context.contracts;
  const emitters = new Map<string, Abi>([
    [factoryAddress(context.factory), abis.NodeFactoryAbi],
    [factoryAddress(contracts.deployer), abis.NodeDeployerAbi],
    [factoryAddress(contracts.roles), abis.NodeRolesAbi],
    [factoryAddress(contracts.marketFactory), abis.MarketFactoryAbi],
    [factoryAddress(contracts.amm), abis.AMMEngineAbi],
    [factoryAddress(contracts.book), abis.OrderEngineAbi],
    [factoryAddress(contracts.ammVault), abis.AmmFeeVaultAbi],
    [factoryAddress(contracts.bookVault), abis.BookFeeVaultAbi],
    [factoryAddress(contracts.positionManager), abis.LPPositionManagerAbi],
  ]);
  const market = input.market === undefined ? undefined : factoryAddress(input.market);
  if (market) emitters.set(market, abis.TruthMarketAbi);
  const events: FactoryReceiptEvent[] = [];
  for (const log of receipt.logs) {
    const abi = emitters.get(log.address.toLowerCase());
    if (
      !abi ||
      log.removed ||
      log.logIndex === null ||
      log.blockNumber !== receipt.blockNumber ||
      log.transactionIndex !== receipt.transactionIndex ||
      log.transactionHash?.toLowerCase() !== receipt.transactionHash.toLowerCase() ||
      log.blockHash?.toLowerCase() !== receipt.blockHash.toLowerCase()
    )
      continue;
    let event;
    try {
      event = decodeEventLog({ abi, data: log.data, topics: log.topics, strict: true });
    } catch {
      continue;
    }
    if (!event.eventName || event.args === undefined) continue;
    const args: FactoryReceiptEvent['args'] = event.args;
    if (
      market &&
      'market' in args &&
      (typeof args.market !== 'string' || args.market.toLowerCase() !== market)
    )
      continue;
    events.push({ eventName: event.eventName, args, address: log.address, logIndex: log.logIndex });
  }
  return events;
}
