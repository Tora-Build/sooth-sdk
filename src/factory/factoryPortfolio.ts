import {
  decodeEventLog,
  type Address,
  type AbiEvent,
  type Hex,
  type PublicClient,
  type TransactionReceipt,
} from 'viem';
import { liquidityValueWad } from './factoryTrade/settlement.js';
import {
  factoryAddress,
  factoryMarketScope,
  factoryReadScope,
  factoryReadClient,
  type FactoryAccountParams,
  type FactoryMarketParams,
  type FactoryReadParams,
  type FactoryReadClient,
} from './factoryClient.js';
import { factoryHash, type FactoryObservation } from './schema.js';

export interface FactoryEventLog {
  args: Record<string, unknown>;
}
export interface FactoryEventClient extends FactoryReadClient {
  getTransactionReceipt?(input: { hash: Hex }): Promise<TransactionReceipt>;
  getCanonicalBlock?(input: { blockNumber: bigint }): Promise<{ number: bigint; hash: Hex }>;
  getLogs(input: {
    address: Address;
    event: AbiEvent;
    args?: Record<string, unknown>;
    fromBlock: bigint;
    toBlock: bigint;
    strict: true;
  }): Promise<readonly FactoryEventLog[]>;
}
export interface FactoryScanOptions {
  fromBlock?: bigint;
  chunkSize?: bigint;
  maxChunks?: number;
  maxItems?: number;
}
export function factoryEventClient(client: PublicClient): FactoryEventClient {
  return {
    ...factoryReadClient(client),
    getTransactionReceipt: (input) => client.getTransactionReceipt(input),
    getCanonicalBlock: async (input) => {
      const block = await client.getBlock(input);
      return { number: block.number, hash: block.hash };
    },
    getLogs: async (input) =>
      (await client.getLogs(input)) as unknown as readonly FactoryEventLog[],
  };
}

/** Exhaustion is an error. A partial scan must never be called an empty portfolio. */
export async function scanFactoryEvents(
  input: FactoryReadParams &
    FactoryScanOptions & {
      client: FactoryEventClient;
      address: Address;
      event: AbiEvent;
      args?: Record<string, unknown>;
    },
) {
  const { blockNumber } = await factoryReadScope(input);
  const from = input.fromBlock ?? input.context.startBlock;
  const chunk = input.chunkSize ?? 10_000n;
  const maxChunks = input.maxChunks ?? 200;
  const maxItems = input.maxItems ?? 10_000;
  if (
    chunk <= 0n ||
    from < 0n ||
    from > blockNumber ||
    !Number.isSafeInteger(maxChunks) ||
    maxChunks <= 0 ||
    !Number.isSafeInteger(maxItems) ||
    maxItems <= 0
  )
    throw new Error('Invalid Factory scan bounds');
  if ((blockNumber - from) / chunk + 1n > BigInt(maxChunks))
    throw new Error(
      'Factory event scan exceeds its bound; provide an indexed discovery source or increase the explicit scan budget',
    );
  const logs: FactoryEventLog[] = [];
  for (let start = from; start <= blockNumber; start += chunk) {
    const end = start + chunk - 1n < blockNumber ? start + chunk - 1n : blockNumber;
    logs.push(
      ...(await input.client.getLogs({
        address: input.address,
        event: input.event,
        args: input.args,
        fromBlock: start,
        toBlock: end,
        strict: true,
      })),
    );
    if (logs.length > maxItems) throw new Error('Factory event result exceeds its bound');
  }
  return { blockNumber, logs, fromBlock: from };
}

export interface FactoryLpPosition {
  positionId: bigint;
  market: Address;
  units: bigint;
  /** Circulating supply, not the denominator for principal valuation. */
  totalSupply: bigint;
  residualNoWad: bigint;
  residualYesWad: bigint;
  residualInvalidWad: bigint;
  /** Immutable deposit at mint. Null when creation-event evidence is unavailable. */
  initialSupplyWad: bigint | null;
  /** Proportional estimates. A settled partial burn can carry one WAD unit of dust. */
  valueIfNoWad: bigint | null;
  valueIfYesWad: bigint | null;
  valueIfInvalidWad: bigint | null;
  valuationComplete: boolean;
  valuationGap: string | null;
}
/** Enumerate every receipt class, including additions and transfers. No bootstrap-only lookup. */
export async function discoverFactoryLpPositions(
  input: FactoryReadParams &
    FactoryScanOptions & { account: Address; market?: Address; maxPositions?: number },
) {
  const {
    blockNumber,
    read,
    abis: { LPPositionManagerAbi },
  } = input.market
    ? await factoryMarketScope({ ...input, market: input.market })
    : await factoryReadScope(input);
  const manager = input.context.contracts.positionManager;
  const next = await read<bigint>(manager, LPPositionManagerAbi, 'nextPositionId');
  const max = input.maxPositions ?? 2_000;
  if (!Number.isSafeInteger(max) || max <= 0 || next < 1n || next - 1n > BigInt(max))
    throw new Error('LP receipt discovery exceeds its bound; portfolio is incomplete');
  const positions: FactoryLpPosition[] = [];
  // These reads cover receipt ownership after transfers, burns and additions at one block.
  for (let positionId = 1n; positionId < next; positionId++) {
    const [market, units] = await Promise.all([
      read<Address>(manager, LPPositionManagerAbi, 'positionMarket', [positionId]),
      read<bigint>(manager, LPPositionManagerAbi, 'balanceOf', [input.account, positionId]),
    ]);
    if (input.market && market.toLowerCase() !== input.market.toLowerCase()) continue;
    if (units === 0n) continue;
    const [totalSupply, residualNoWad, residualYesWad, residualInvalidWad] = await Promise.all([
      read<bigint>(manager, LPPositionManagerAbi, 'totalSupply', [positionId]),
      read<bigint>(manager, LPPositionManagerAbi, 'residual', [positionId, 0]),
      read<bigint>(manager, LPPositionManagerAbi, 'residual', [positionId, 1]),
      read<bigint>(manager, LPPositionManagerAbi, 'residual', [positionId, 2]),
    ]);
    positions.push({
      positionId,
      market: factoryAddress(market),
      units,
      totalSupply,
      residualNoWad,
      residualYesWad,
      residualInvalidWad,
      initialSupplyWad: null,
      valueIfNoWad: null,
      valueIfYesWad: null,
      valueIfInvalidWad: null,
      valuationComplete: false,
      valuationGap:
        'LP principal estimates require the original PositionOpened deposit; current supply is not a valid denominator.',
    });
  }
  if (positions.length && 'getLogs' in input.client && typeof input.client.getLogs === 'function') {
    try {
      const event = LPPositionManagerAbi.find(
        (item) => item.type === 'event' && item.name === 'PositionOpened',
      ) as AbiEvent;
      const { logs } = await scanFactoryEvents({
        ...input,
        client: input.client as FactoryEventClient,
        blockNumber,
        address: manager,
        event,
        args: input.market ? { market: input.market } : undefined,
      });
      for (const position of positions) {
        const matches = logs.filter((log) => log.args.positionId === position.positionId);
        if (matches.length !== 1)
          throw new Error(`Original deposit unavailable for LP receipt ${position.positionId}`);
        const deposit = matches[0]!.args.deposit;
        if (
          typeof deposit !== 'bigint' ||
          deposit <= 0n ||
          deposit < position.totalSupply ||
          position.units > position.totalSupply ||
          factoryAddress(matches[0]!.args.market) !== position.market
        )
          throw new Error('Malformed LP creation event');
        position.initialSupplyWad = deposit;
        position.valueIfNoWad = liquidityValueWad(position.residualNoWad, position.units, deposit);
        position.valueIfYesWad = liquidityValueWad(
          position.residualYesWad,
          position.units,
          deposit,
        );
        position.valueIfInvalidWad = liquidityValueWad(
          position.residualInvalidWad,
          position.units,
          deposit,
        );
        position.valuationComplete = true;
        position.valuationGap = null;
      }
    } catch (error) {
      for (const position of positions)
        if (!position.valuationComplete)
          position.valuationGap = error instanceof Error ? error.message : String(error);
    }
  }
  return { blockNumber, positions, complete: true as const, scannedPositions: next - 1n };
}

export interface FactoryBookOrder {
  orderId: bigint;
  market: Address;
  maker: Address;
  action: number;
  outcome: number;
  yesTick: number;
  amount: bigint;
  expiry: bigint;
  cashReserved: bigint;
}
export async function readFactoryBookOrders(
  input: FactoryAccountParams &
    FactoryScanOptions & { client: FactoryEventClient; marketCreation?: FactoryObservation },
) {
  const {
    blockNumber,
    read,
    abis: { OrderEngineAbi, MarketFactoryAbi },
  } = await factoryMarketScope(input);
  let discoveryStart = input.context.startBlock;
  if (input.marketCreation) {
    const creation = input.marketCreation;
    if (
      !Number.isSafeInteger(creation.blockNumber) ||
      creation.blockNumber < 0 ||
      !Number.isSafeInteger(creation.logIndex) ||
      creation.logIndex < 0
    )
      throw new Error('Invalid market creation observation');
    const creationBlock = BigInt(creation.blockNumber);
    if (creationBlock < input.context.startBlock || creationBlock > blockNumber)
      throw new Error('Market creation is outside the verified history');
    if (!input.client.getTransactionReceipt || !input.client.getCanonicalBlock)
      throw new Error('Market creation requires receipt and canonical block verification');
    const transactionHash = factoryHash(creation.transactionHash);
    const blockHash = factoryHash(creation.blockHash);
    const [receipt, block] = await Promise.all([
      input.client.getTransactionReceipt({ hash: transactionHash }),
      input.client.getCanonicalBlock({ blockNumber: creationBlock }),
    ]);
    if (
      receipt.status !== 'success' ||
      factoryHash(receipt.transactionHash) !== transactionHash ||
      receipt.blockNumber !== creationBlock ||
      factoryHash(receipt.blockHash) !== blockHash ||
      block.number !== creationBlock ||
      factoryHash(block.hash) !== blockHash
    )
      throw new Error('Market creation receipt is not canonical');
    const matches = receipt.logs.filter((log) => log.logIndex === creation.logIndex);
    if (matches.length !== 1) throw new Error('Market creation log is missing or ambiguous');
    const log = matches[0]!;
    if (
      log.removed ||
      factoryAddress(log.address) !== factoryAddress(input.context.contracts.marketFactory) ||
      log.blockNumber !== creationBlock ||
      factoryHash(log.blockHash) !== blockHash ||
      factoryHash(log.transactionHash) !== transactionHash
    )
      throw new Error('Market creation log identity mismatch');
    const event = decodeEventLog({
      abi: MarketFactoryAbi,
      data: log.data,
      topics: log.topics,
      strict: true,
    });
    if (
      event.eventName !== 'MarketCreated' ||
      !event.args ||
      !('market' in event.args) ||
      factoryAddress(event.args.market) !== factoryAddress(input.market)
    )
      throw new Error('Creation event belongs to another market');
    discoveryStart = creationBlock;
  }
  if (input.fromBlock !== undefined && input.fromBlock > discoveryStart)
    throw new Error('Open-order discovery cannot skip verified market history');
  const event = OrderEngineAbi.find(
    (item) => item.type === 'event' && item.name === 'OrderPlaced',
  ) as AbiEvent;
  const { logs } = await scanFactoryEvents({
    ...input,
    fromBlock: input.fromBlock ?? discoveryStart,
    blockNumber,
    address: input.context.contracts.book,
    event,
    args: { market: input.market, maker: input.account },
  });
  const ids = [...new Set(logs.map((log) => String(log.args.orderId)))];
  const orders: FactoryBookOrder[] = [];
  for (const id of ids) {
    if (!/^[1-9]\d*$/.test(id)) throw new Error('Malformed order discovery log');
    const orderId = BigInt(id);
    const order = await read<Omit<FactoryBookOrder, 'orderId'>>(
      input.context.contracts.book,
      OrderEngineAbi,
      'getOrder',
      [orderId],
    );
    if (order.amount === 0n) continue; // Filled/cancelled records are cleared by the engine.
    if (
      order.market.toLowerCase() !== input.market.toLowerCase() ||
      order.maker.toLowerCase() !== input.account.toLowerCase()
    )
      throw new Error('Order discovery returned another identity');
    if (order.amount > 0n) orders.push({ ...order, orderId });
  }
  return { blockNumber, orders, complete: true as const };
}

/** Scan the node book once for this maker; retain full release history and canonical reads. */
export async function readFactoryNodeBookOrders(
  input: FactoryReadParams & FactoryScanOptions & { account: Address; client: FactoryEventClient },
) {
  if (input.fromBlock !== undefined && input.fromBlock > input.context.startBlock)
    throw new Error(
      'Open-order discovery must start at the node release block; a later window can miss resting orders',
    );
  const account = factoryAddress(input.account);
  const {
    blockNumber,
    read,
    abis: { OrderEngineAbi },
  } = await factoryReadScope(input);
  const event = OrderEngineAbi.find(
    (item) => item.type === 'event' && item.name === 'OrderPlaced',
  ) as AbiEvent;
  const { logs } = await scanFactoryEvents({
    ...input,
    blockNumber,
    address: input.context.contracts.book,
    event,
    args: { maker: account },
  });
  const ids = [...new Set(logs.map((log) => String(log.args.orderId)))];
  const orders: FactoryBookOrder[] = [];
  const checkedMarkets = new Set<string>();
  for (const id of ids) {
    if (!/^[1-9]\d*$/.test(id)) throw new Error('Malformed order discovery log');
    const orderId = BigInt(id);
    const order = await read<Omit<FactoryBookOrder, 'orderId'>>(
      input.context.contracts.book,
      OrderEngineAbi,
      'getOrder',
      [orderId],
    );
    if (order.amount === 0n) continue; // Cleared records have zero maker/market.
    if (factoryAddress(order.maker) !== account)
      throw new Error('Order discovery returned another maker');
    const market = factoryAddress(order.market);
    if (!checkedMarkets.has(market)) {
      await factoryMarketScope({ ...input, market, blockNumber });
      checkedMarkets.add(market);
    }
    orders.push({ ...order, market, orderId });
  }
  return { blockNumber, orders, complete: true as const };
}

export interface FactoryBookLevel {
  side: 0 | 1;
  yesTick: number;
  amountWad: bigint;
  orderCount: bigint;
}
/** Read a declared tick window. `complete` is true only for all 999 ticks. */
export async function readFactoryBookDepth(
  input: FactoryMarketParams & { fromTick?: number; toTick?: number },
) {
  const {
    blockNumber,
    read,
    abis: { OrderEngineAbi },
  } = await factoryMarketScope(input);
  const fromTick = input.fromTick ?? 1;
  const toTick = input.toTick ?? 999;
  if (
    !Number.isInteger(fromTick) ||
    !Number.isInteger(toTick) ||
    fromTick < 1 ||
    toTick > 999 ||
    fromTick > toTick
  )
    throw new Error('Invalid depth tick bounds');
  const levels: FactoryBookLevel[] = [];
  for (let start = fromTick; start <= toTick; start += 25) {
    const calls = [];
    for (let tick = start; tick <= Math.min(start + 24, toTick); tick++)
      for (const side of [0, 1] as const) {
        calls.push(
          read<readonly [bigint, bigint]>(
            input.context.contracts.book,
            OrderEngineAbi,
            'getOrdersAtTick',
            [input.market, side, tick],
          ).then(([amountWad, orderCount]) => ({ side, yesTick: tick, amountWad, orderCount })),
        );
      }
    levels.push(...(await Promise.all(calls)).filter((level) => level.amountWad > 0n));
  }
  return { blockNumber, levels, fromTick, toTick, complete: fromTick === 1 && toTick === 999 };
}

/** Floor entitlement is WAD. Fee, refund and deferred balances use native units. */
export async function readFactoryEntitlements(
  input: FactoryAccountParams & FactoryScanOptions & { maxPositions?: number },
) {
  const {
    blockNumber,
    read,
    abis: {
      AMMEngineAbi,
      AmmFeeVaultAbi,
      BookFeeVaultAbi,
      LPPositionManagerAbi,
      OrderEngineAbi,
      TruthMarketAbi,
    },
  } = await factoryMarketScope(input);
  const { amm, book, ammVault, bookVault, positionManager } = input.context.contracts;
  const tokenA = factoryAddress(await read<Address>(amm, AMMEngineAbi, 'tokenAOf', [input.market]));
  const bookToken = factoryAddress(await read<Address>(book, OrderEngineAbi, 'baseToken'));
  const args = [input.market, input.account];
  const [
    floorWad,
    lpDividendNative,
    checkpointedLpFeesNative,
    bookTimeoutRefundNative,
    bookDeferredNative,
  ] = await Promise.all([
    read<bigint>(amm, AMMEngineAbi, 'floorEntitlementOf', args),
    read<bigint>(ammVault, AmmFeeVaultAbi, 'lpEntitlementOf', [...args, tokenA]),
    read<bigint>(positionManager, LPPositionManagerAbi, 'claimableFees', args),
    read<bigint>(bookVault, BookFeeVaultAbi, 'refundableResolutionOf', args),
    read<bigint>(book, OrderEngineAbi, 'deferredOf', [input.account]),
  ]);
  let simulatedLpFeesNative: bigint | null = null;
  let lpFeesGap: string | null =
    'Uncheckpointed position fees require claim simulation; checkpointed fees are not the total entitlement.';
  const settled = await read<boolean>(input.market, TruthMarketAbi, 'isSettled');
  if (settled && input.client.simulateContract) {
    try {
      const simulate = async (functionName: string, args: readonly unknown[]) =>
        (
          await input.client.simulateContract!({
            address: ammVault,
            abi: AmmFeeVaultAbi,
            functionName,
            args,
            account: input.account,
            blockNumber,
          })
        ).result as bigint;
      const { positions } = await discoverFactoryLpPositions({ ...input, blockNumber });
      if (positions.length <= 1) {
        const total =
          positions.length === 0
            ? await simulate('claimLPDividend', [input.market])
            : await simulate('claimLPDividendForPosition', [
                input.market,
                positions[0]!.positionId,
              ]);
        if (typeof total !== 'bigint' || total < 0n) throw new Error('Malformed LP claim result');
        simulatedLpFeesNative = total;
      } else {
        if (!input.client.simulateSequence)
          throw new Error(
            'Aggregate LP fees require sequential simulation for multiple receipt classes; this client does not support it.',
          );
        // Account remainders carry across positions. Independent calls cannot
        // be summed, even after subtracting the common checkpointed balance.
        const results = await input.client.simulateSequence({
          account: input.account,
          blockNumber,
          calls: [
            ...positions.map((position) => ({
              address: positionManager,
              abi: LPPositionManagerAbi,
              functionName: 'checkpointFees',
              args: [position.positionId, input.account],
            })),
            {
              address: ammVault,
              abi: AmmFeeVaultAbi,
              functionName: 'claimLPDividend',
              args: [input.market],
            },
          ],
        });
        const total = results[results.length - 1];
        if (typeof total !== 'bigint' || total < 0n || results.length !== positions.length + 1)
          throw new Error('Malformed sequential LP claim result');
        simulatedLpFeesNative = total;
      }
      lpFeesGap = null;
    } catch (error) {
      lpFeesGap = error instanceof Error ? error.message : String(error);
    }
  } else if (!settled) lpFeesGap = 'LP fees cannot be claimed before market settlement.';
  return {
    blockNumber,
    tokenA,
    bookToken,
    floorWad,
    lpDividendNative,
    checkpointedLpFeesNative,
    bookTimeoutRefundNative,
    bookDeferredNative,
    simulatedLpFeesNative,
    lpFeesComplete: simulatedLpFeesNative !== null,
    lpFeesGap,
  };
}

/** Selected-venue trader claims; LP accounting is exposed separately by readFactoryEntitlements. */
export async function readFactoryConsumerEntitlements(
  input: FactoryAccountParams & { venue: 'amm' | 'book' },
) {
  const { blockNumber, read, abis } = await factoryMarketScope(input);
  const { amm, book, bookVault } = input.context.contracts;
  if (input.venue === 'amm') {
    const floorWad = await read<bigint>(amm, abis.AMMEngineAbi, 'floorEntitlementOf', [
      input.market,
      input.account,
    ]);
    return { blockNumber, floorWad, bookTimeoutRefundNative: null, bookDeferredNative: null };
  }
  const [bookTimeoutRefundNative, bookDeferredNative] = await Promise.all([
    read<bigint>(bookVault, abis.BookFeeVaultAbi, 'refundableResolutionOf', [
      input.market,
      input.account,
    ]),
    read<bigint>(book, abis.OrderEngineAbi, 'deferredOf', [input.account]),
  ]);
  return { blockNumber, floorWad: null, bookTimeoutRefundNative, bookDeferredNative };
}
