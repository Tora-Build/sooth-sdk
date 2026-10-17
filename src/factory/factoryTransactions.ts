import {
  decodeEventLog,
  encodeFunctionData,
  erc20Abi,
  zeroAddress,
  zeroHash,
  type Abi,
  type Address,
  type Hex,
  type TransactionReceipt,
} from 'viem';
import { getFactoryAbis } from './factoryAbi/index.js';
import {
  verifyFactoryOperation,
  factoryAddress,
  factoryHash,
  type FactoryNodeContext,
} from './factoryClient.js';
import type { AnchorEndpoint } from './factoryTrade/anchorClient.js';
import {
  readFactoryAdjudicatorBinding,
  verifyFactoryAdjudicatorBinding,
  type FactoryAdjudicatorBinding,
} from './adjudicators.js';

export interface FactoryOrderParams {
  outcome: 0 | 1;
  action: 0 | 1;
  priceTick: number;
  amount: bigint;
  matchLimit: number;
  validUntil: bigint;
  expiry: bigint;
  rest: boolean;
  postOnly: boolean;
  maxTokenIn: bigint;
  minTokenOut: bigint;
}
export interface FactoryLiquidityLimits {
  maxTokenIn: bigint;
  minLpOut: bigint;
  minYesPrice: bigint;
  maxYesPrice: bigint;
  deadline: bigint;
  expectedStateHash: Hex;
}
export interface FactoryAmmConfig {
  feeBps: number;
  capitalBps: number;
  lpBps: number;
  resolutionBps: number;
  operatorBps: number;
  operatorRecipient: Address;
}
export interface FactoryBookConfig {
  feeBps: number;
  resolutionBps: number;
  protocolBps: number;
  protocolRecipient: Address;
}
/** Exact MarketFactory.MarketParams tuple for the supported releases. */
export interface FactoryCreationParams {
  question: string;
  startTime: bigint;
  deadline: bigint;
  adjudicator: Address;
  tokenA: Address;
  bBase: bigint;
  initialProbabilityWad: bigint;
  adjudicatorConfig: Hex;
  maxInputNative: bigint;
  quoteDeadline: bigint;
  expectedAmmVersion: number;
  expectedBookVersion: number;
  expectedAmmHash: Hex;
  expectedBookHash: Hex;
  resolutionTermsHash: Hex;
  expectedProfileHash: Hex;
  expectedInvalidationBuffer: bigint;
}
export type FactoryTransactionAction =
  | { kind: 'createMarket'; params: FactoryCreationParams }
  | { kind: 'approveCreation'; tokenA: Address; amountNative: bigint }
  | { kind: 'proposeNodeAdmin' | 'proposeProtocolAuthority'; next: Address }
  | {
      kind:
        | 'acceptNodeAdmin'
        | 'cancelNodeAdminTransfer'
        | 'acceptProtocolAuthority'
        | 'cancelProtocolAuthorityTransfer';
    }
  | { kind: 'advanceHead'; side: 0 | 1; tick: number; maxSteps: bigint }
  | { kind: 'approve'; venue: 'amm' | 'book'; amountNative: bigint }
  | { kind: 'trade'; outcome: 0 | 1; deltaShares: bigint; boundWad: bigint }
  | { kind: 'placeOrder'; order: FactoryOrderParams }
  | { kind: 'cancelOrder'; orderId: bigint }
  | { kind: 'split'; amountWad: bigint; maxTokenIn: bigint; validUntil: bigint }
  | { kind: 'merge'; amountWad: bigint; minTokenOut: bigint; validUntil: bigint }
  | { kind: 'settlePosition'; venue: 'amm' | 'book' }
  | { kind: 'increaseLiquidity'; additionalB: bigint; limits: FactoryLiquidityLimits }
  | { kind: 'claimAvailable' | 'redeemLPPosition'; positionId: bigint; units: bigint }
  | { kind: 'claimLPDividendForPosition'; positionId: bigint }
  | { kind: 'transferLP'; positionId: bigint; receiver: Address; units: bigint }
  | {
      kind: 'acceptMandate';
      adjudicator: Address;
      creator: Address;
      sqfHash: Hex;
      deadline: bigint;
      jobId: Hex;
      reportHash: Hex;
    }
  | { kind: 'recordJudgment'; outcome: 0 | 1 | 2; jobId: Hex; reportHash: Hex }
  | { kind: 'resolve'; outcome: 0 | 1 | 2; dataHash: Hex }
  | { kind: 'attest'; proof: Hex }
  | { kind: 'veto' | 'settle' | 'invalidate' }
  | { kind: 'publishAmmConfig'; config: FactoryAmmConfig }
  | { kind: 'publishBookConfig'; config: FactoryBookConfig }
  | { kind: 'setCreationPaused'; paused: boolean }
  | { kind: 'setPermissionlessCreation'; allowed: boolean }
  | { kind: 'setCreatorAllowed'; creator: Address; allowed: boolean }
  | { kind: 'setTokenAllowed'; token: Address; allowed: boolean }
  | { kind: 'setAdjudicatorAllowed'; adjudicator: Address; allowed: boolean }
  | { kind: 'setInvalidationBuffer'; buffer: bigint }
  | { kind: 'claimOperatorFees' | 'claimProtocolFees' }
  | { kind: 'claimResolutionFees'; venue: 'amm' | 'book' }
  | { kind: 'claimFloor' | 'claimLPDividend' | 'claimTimeoutRefund' | 'claimDeferred' };
export type FactoryNodeAction =
  | Extract<
      FactoryTransactionAction,
      {
        kind:
          | 'createMarket'
          | 'acceptMandate'
          | 'approveCreation'
          | 'proposeNodeAdmin'
          | 'proposeProtocolAuthority'
          | 'acceptNodeAdmin'
          | 'cancelNodeAdminTransfer'
          | 'acceptProtocolAuthority'
          | 'cancelProtocolAuthorityTransfer'
          | 'publishAmmConfig'
          | 'publishBookConfig'
          | 'setCreationPaused'
          | 'setPermissionlessCreation'
          | 'setCreatorAllowed'
          | 'setTokenAllowed'
          | 'setAdjudicatorAllowed'
          | 'setInvalidationBuffer';
      }
    >
  | { kind: 'claimDeferred' };
export type FactoryTransactionInput = {
  context: FactoryNodeContext;
  endpoints: readonly AnchorEndpoint[];
  account: Address;
  adjudicatorBinding?: FactoryAdjudicatorBinding;
} & (
  | { market?: Address; action: FactoryNodeAction }
  | { market: Address; action: FactoryTransactionAction }
);
export interface FactoryTransactionRequest {
  chainId: number;
  account: Address;
  address: Address;
  abi: Abi;
  functionName: string;
  args: readonly unknown[];
  to: Address;
  data: Hex;
  value: 0n;
  verifiedBlockNumber: bigint;
  verifiedContext: FactoryNodeContext;
}

/** Build and simulate one request after fresh quorum verification. */
export async function buildFactoryTransaction(
  input: FactoryTransactionInput,
): Promise<FactoryTransactionRequest> {
  const nodeScoped = [
    'createMarket',
    'acceptMandate',
    'approveCreation',
    'proposeNodeAdmin',
    'proposeProtocolAuthority',
    'acceptNodeAdmin',
    'cancelNodeAdminTransfer',
    'acceptProtocolAuthority',
    'cancelProtocolAuthorityTransfer',
    'publishAmmConfig',
    'publishBookConfig',
    'setCreationPaused',
    'setPermissionlessCreation',
    'setCreatorAllowed',
    'setTokenAllowed',
    'setAdjudicatorAllowed',
    'setInvalidationBuffer',
    'claimDeferred',
  ].includes(input.action.kind);
  const {
    AMMEngineAbi,
    AmmFeeVaultAbi,
    BookFeeVaultAbi,
    LPPositionManagerAbi,
    OrderEngineAbi,
    TruthMarketAbi,
    MarketFactoryAbi,
    NodeRolesAbi,
  } = getFactoryAbis(input.context.release);
  const bindingInput = {
    identity: input.context,
    release: input.context.release,
    endpoints: input.endpoints,
    catalog: input.context.contracts,
  };
  if (!nodeScoped && !input.market) throw new Error('This action requires a market');
  const {
    context: bound,
    reader,
    read,
    marketBinding,
  } = await verifyFactoryOperation({
    ...bindingInput,
    market: nodeScoped ? undefined : input.market,
  });
  const blockNumber = bound.blockNumber;
  const c = bound.contracts;
  const a = input.action;
  const market = input.market ? factoryAddress(input.market) : undefined;
  const account = factoryAddress(input.account);
  let address: Address;
  let abi: Abi;
  let functionName: string;
  let args: readonly unknown[];
  switch (a.kind) {
    case 'acceptMandate': {
      const target = factoryAddress(a.adjudicator);
      const binding =
        input.adjudicatorBinding ??
        (await readFactoryAdjudicatorBinding(
          { ...reader, getChainId: async () => bound.chainId },
          { chainId: bound.chainId, address: target, marketFactory: c.marketFactory },
          { blockNumber },
        ));
      if (
        factoryAddress(binding.address) !== target ||
        factoryAddress(binding.marketFactory) !== c.marketFactory
      )
        throw new Error('Adjudicator binding mismatch');
      const adapter = await verifyFactoryAdjudicatorBinding(
        { ...reader, getChainId: async () => bound.chainId },
        binding,
        { blockNumber },
      );
      if (!adapter.capabilities.includes('acceptMandate'))
        throw new Error(`Adjudicator ${adapter.kind} does not support acceptMandate`);
      if (a.deadline <= 0n || a.deadline >= (1n << 64n) - 1n)
        throw new Error('Swarm deadline must be finite uint64');
      address = target;
      abi = adapter.abi;
      functionName = a.kind;
      args = [
        factoryAddress(a.creator),
        factoryHash(a.sqfHash),
        a.deadline,
        factoryHash(a.jobId),
        factoryHash(a.reportHash),
      ];
      break;
    }
    case 'approveCreation':
      if (a.amountNative < 0n || a.amountNative >= (1n << 256n) - 1n)
        throw new Error('Creation approval must be finite');
      address = factoryAddress(a.tokenA);
      if (!(await read(c.marketFactory, MarketFactoryAbi, 'allowedTokens', [address])))
        throw new Error('Creation token is not admitted');
      abi = erc20Abi;
      functionName = 'approve';
      args = [c.marketFactory, a.amountNative];
      break;
    case 'createMarket': {
      const p = a.params;
      if (
        p.bBase < 10n ** 17n ||
        p.maxInputNative <= 0n ||
        p.maxInputNative >= (1n << 256n) - 1n ||
        p.quoteDeadline > p.deadline ||
        p.deadline === (1n << 64n) - 1n ||
        p.startTime >= p.deadline
      )
        throw new Error('Invalid creation bounds');
      if (
        factoryHash(p.resolutionTermsHash) === zeroHash ||
        factoryHash(p.expectedProfileHash) === zeroHash
      )
        throw new Error('Creation requires committed terms and profile');
      const [paused, tokenAllowed, admitted, buffer, ammVersion, bookVersion, ammHash, bookHash] =
        await Promise.all([
          read(c.marketFactory, MarketFactoryAbi, 'creationPaused'),
          read(c.marketFactory, MarketFactoryAbi, 'allowedTokens', [p.tokenA]),
          read(c.marketFactory, MarketFactoryAbi, 'admittedProfileHash', [p.adjudicator]),
          read(c.marketFactory, MarketFactoryAbi, 'invalidationBuffer'),
          read(c.ammVault, AmmFeeVaultAbi, 'activeConfigVersion'),
          read(c.bookVault, BookFeeVaultAbi, 'activeConfigVersion'),
          read(c.ammVault, AmmFeeVaultAbi, 'configHash', [p.expectedAmmVersion]),
          read(c.bookVault, BookFeeVaultAbi, 'configHash', [p.expectedBookVersion]),
        ]);
      if (paused || !tokenAllowed) throw new Error('Creation is closed or token is not admitted');
      if (
        factoryHash(admitted) !== factoryHash(p.expectedProfileHash) ||
        buffer !== p.expectedInvalidationBuffer ||
        buffer === 0n
      )
        throw new Error('Creation profile or invalidation buffer changed');
      if (
        Number(ammVersion) !== p.expectedAmmVersion ||
        Number(bookVersion) !== p.expectedBookVersion ||
        factoryHash(ammHash) !== factoryHash(p.expectedAmmHash) ||
        factoryHash(bookHash) !== factoryHash(p.expectedBookHash)
      )
        throw new Error('Creation fee configuration changed');
      const binding =
        input.adjudicatorBinding ??
        (await readFactoryAdjudicatorBinding(
          { ...reader, getChainId: async () => bound.chainId },
          {
            chainId: bound.chainId,
            address: p.adjudicator,
            marketFactory: c.marketFactory,
            profileHash: p.expectedProfileHash,
          },
          { blockNumber },
        ));
      if (
        factoryAddress(binding.address) !== factoryAddress(p.adjudicator) ||
        factoryAddress(binding.marketFactory) !== c.marketFactory ||
        factoryHash(binding.profileHash) !== factoryHash(p.expectedProfileHash)
      )
        throw new Error('Creation adjudicator binding mismatch');
      await verifyFactoryAdjudicatorBinding(
        { ...reader, getChainId: async () => bound.chainId },
        binding,
        { blockNumber },
      );
      address = c.marketFactory;
      abi = MarketFactoryAbi;
      functionName = 'createMarket';
      args = [p];
      break;
    }
    case 'proposeNodeAdmin':
    case 'proposeProtocolAuthority':
      address = c.roles;
      abi = NodeRolesAbi;
      functionName = a.kind;
      args = [factoryAddress(a.next)];
      break;
    case 'acceptNodeAdmin':
    case 'cancelNodeAdminTransfer':
    case 'acceptProtocolAuthority':
    case 'cancelProtocolAuthorityTransfer':
      address = c.roles;
      abi = NodeRolesAbi;
      functionName = a.kind;
      args = [];
      break;
    case 'advanceHead':
      if (
        (a.side !== 0 && a.side !== 1) ||
        !Number.isInteger(a.tick) ||
        a.tick < 1 ||
        a.tick > 999 ||
        a.maxSteps < 1n ||
        a.maxSteps > 1024n
      )
        throw new Error('Invalid head maintenance bounds');
      address = c.book;
      abi = OrderEngineAbi;
      functionName = 'advanceHead';
      args = [market, a.side, a.tick, a.maxSteps];
      break;
    case 'approve':
      if (a.amountNative < 0n) throw new Error('Negative approval');
      address = factoryAddress(
        await (a.venue === 'amm'
          ? read(c.amm, AMMEngineAbi, 'tokenAOf', [market])
          : read(c.book, OrderEngineAbi, 'baseToken')),
      );
      abi = erc20Abi;
      functionName = 'approve';
      args = [a.venue === 'amm' ? c.amm : c.book, a.amountNative];
      break;
    case 'trade':
      if ((a.outcome !== 0 && a.outcome !== 1) || a.deltaShares === 0n || a.boundWad < 0n)
        throw new Error('Invalid AMM trade');
      address = c.amm;
      abi = AMMEngineAbi;
      functionName = 'tradePositions';
      args = [market, a.outcome, a.deltaShares, a.boundWad];
      break;
    case 'placeOrder':
      if (
        (a.order.outcome !== 0 && a.order.outcome !== 1) ||
        (a.order.action !== 0 && a.order.action !== 1) ||
        a.order.priceTick < 1 ||
        a.order.priceTick > 999 ||
        a.order.amount <= 0n
      )
        throw new Error('Invalid book order');
      address = c.book;
      abi = OrderEngineAbi;
      functionName = 'placeOrder';
      args = [market, a.order];
      break;
    case 'cancelOrder': {
      const order = (await read(c.book, OrderEngineAbi, 'getOrder', [a.orderId])) as {
        market: Address;
        maker: Address;
      };
      if (order.market.toLowerCase() !== market || order.maker.toLowerCase() !== account)
        throw new Error('Order is not owned by this account on this market');
      address = c.book;
      abi = OrderEngineAbi;
      functionName = 'cancelById';
      args = [a.orderId];
      break;
    }
    case 'split':
    case 'merge':
      if (a.amountWad <= 0n) throw new Error('Invalid set amount');
      address = c.book;
      abi = OrderEngineAbi;
      functionName = a.kind;
      args = [market, a.amountWad, a.kind === 'split' ? a.maxTokenIn : a.minTokenOut, a.validUntil];
      break;
    case 'settlePosition':
      address = a.venue === 'amm' ? c.amm : c.book;
      abi = a.venue === 'amm' ? AMMEngineAbi : OrderEngineAbi;
      functionName = a.kind;
      args = [market];
      break;
    case 'increaseLiquidity':
      if (a.additionalB <= 0n) throw new Error('Invalid liquidity amount');
      address = c.amm;
      abi = AMMEngineAbi;
      functionName = a.kind;
      args = [market, a.additionalB, a.limits];
      break;
    case 'claimAvailable':
    case 'redeemLPPosition':
    case 'claimLPDividendForPosition':
      if (
        factoryAddress(
          await read(c.positionManager, LPPositionManagerAbi, 'positionMarket', [a.positionId]),
        ) !== market
      )
        throw new Error('LP position belongs to another market');
      address = a.kind === 'claimLPDividendForPosition' ? c.ammVault : c.amm;
      abi = a.kind === 'claimLPDividendForPosition' ? AmmFeeVaultAbi : AMMEngineAbi;
      functionName = a.kind;
      args =
        a.kind === 'claimLPDividendForPosition'
          ? [market, a.positionId]
          : [market, a.positionId, a.units];
      break;
    case 'claimFloor':
      address = c.amm;
      abi = AMMEngineAbi;
      functionName = a.kind;
      args = [market];
      break;
    case 'claimLPDividend':
      address = c.ammVault;
      abi = AmmFeeVaultAbi;
      functionName = a.kind;
      args = [market];
      break;
    case 'claimTimeoutRefund':
      address = c.bookVault;
      abi = BookFeeVaultAbi;
      functionName = a.kind;
      args = [market, account];
      break;
    case 'claimDeferred':
      address = c.book;
      abi = OrderEngineAbi;
      functionName = a.kind;
      args = [];
      break;
    case 'transferLP': {
      if (
        a.units <= 0n ||
        factoryAddress(
          await read(c.positionManager, LPPositionManagerAbi, 'positionMarket', [a.positionId]),
        ) !== market
      )
        throw new Error('Invalid LP transfer market or units');
      const units = (await read(c.positionManager, LPPositionManagerAbi, 'balanceOf', [
        account,
        a.positionId,
      ])) as bigint;
      if (units < a.units) throw new Error('Insufficient LP receipt units');
      address = c.positionManager;
      abi = LPPositionManagerAbi;
      functionName = 'transfer';
      args = [factoryAddress(a.receiver), a.positionId, a.units];
      break;
    }
    case 'recordJudgment':
    case 'resolve':
    case 'attest':
    case 'veto':
    case 'settle': {
      if (!marketBinding) throw new Error('Market binding required');
      const profileHash = factoryHash(
        await read(
          marketBinding.adjudicator,
          [
            {
              type: 'function',
              name: 'profileHash',
              stateMutability: 'view',
              inputs: [],
              outputs: [{ type: 'bytes32' }],
            },
          ],
          'profileHash',
        ),
      );
      const binding =
        input.adjudicatorBinding ??
        (await readFactoryAdjudicatorBinding(
          { ...reader, getChainId: async () => bound.chainId },
          {
            chainId: bound.chainId,
            address: marketBinding.adjudicator,
            marketFactory: c.marketFactory,
            profileHash,
          },
          { blockNumber, requireAdmission: false },
        ));
      if (
        factoryAddress(binding.address) !== marketBinding.adjudicator ||
        factoryAddress(binding.marketFactory) !== c.marketFactory ||
        factoryHash(binding.profileHash) !== profileHash
      )
        throw new Error('Adjudicator binding mismatch');
      // The market's immutable adjudicator points to this frozen profile; later
      // admission changes apply only to new markets, never settlement of this one.
      const adapter = await verifyFactoryAdjudicatorBinding(
        { ...reader, getChainId: async () => bound.chainId },
        binding,
        { blockNumber, requireAdmission: false },
      );
      address = marketBinding.adjudicator;
      abi = adapter.abi;
      const capability = a.kind === 'veto' ? 'dispute' : a.kind;
      functionName = capability;
      if (!adapter.capabilities.includes(capability))
        throw new Error(`Adjudicator ${adapter.kind} does not support ${a.kind}`);
      args =
        a.kind === 'recordJudgment'
          ? [market, a.outcome, factoryHash(a.jobId), factoryHash(a.reportHash)]
          : a.kind === 'resolve'
            ? [market, a.outcome, a.dataHash]
            : a.kind === 'attest'
              ? [market, a.proof]
              : [market];
      break;
    }
    case 'invalidate':
      address = market!;
      abi = TruthMarketAbi;
      functionName = a.kind;
      args = [];
      break;
    case 'publishAmmConfig':
    case 'publishBookConfig':
      address = a.kind === 'publishAmmConfig' ? c.ammVault : c.bookVault;
      abi = a.kind === 'publishAmmConfig' ? AmmFeeVaultAbi : BookFeeVaultAbi;
      functionName = a.kind;
      args = [a.config];
      break;
    case 'setCreationPaused':
    case 'setPermissionlessCreation':
    case 'setCreatorAllowed':
    case 'setTokenAllowed':
    case 'setAdjudicatorAllowed':
    case 'setInvalidationBuffer':
      address = c.marketFactory;
      abi = MarketFactoryAbi;
      functionName = a.kind;
      args =
        a.kind === 'setCreationPaused'
          ? [a.paused]
          : a.kind === 'setPermissionlessCreation'
            ? [a.allowed]
            : a.kind === 'setCreatorAllowed'
              ? [a.creator, a.allowed]
              : a.kind === 'setTokenAllowed'
                ? [a.token, a.allowed]
                : a.kind === 'setAdjudicatorAllowed'
                  ? [a.adjudicator, a.allowed]
                  : [a.buffer];
      break;
    case 'claimOperatorFees':
    case 'claimProtocolFees':
    case 'claimResolutionFees':
      address =
        a.kind === 'claimOperatorFees' || (a.kind === 'claimResolutionFees' && a.venue === 'amm')
          ? c.ammVault
          : c.bookVault;
      abi = address === c.ammVault ? AmmFeeVaultAbi : BookFeeVaultAbi;
      functionName = a.kind;
      args = [market];
      break;
  }
  // eth_call executes the exact account-bound contract guards at the verified head.
  await reader.readContract({ address, abi, functionName, args, account, blockNumber });
  const data = encodeFunctionData({ abi, functionName, args });
  return {
    chainId: bound.chainId,
    account,
    address,
    to: address,
    abi,
    functionName,
    args,
    data,
    value: 0n,
    verifiedBlockNumber: blockNumber,
    verifiedContext: bound,
  };
}

/** Accept only an unambiguous creation emitted by this node in this successful receipt. */
export function decodeFactoryCreatedMarket(input: {
  receipt: TransactionReceipt;
  context: FactoryNodeContext;
  account?: Address;
}): Address {
  const { receipt, context } = input;
  const { MarketFactoryAbi } = getFactoryAbis(context.release);
  const emitter = factoryAddress(context.contracts.marketFactory);
  if (
    context.chainId !== context.release.chainId ||
    factoryAddress(context.factory) !== factoryAddress(context.release.factory)
  )
    throw new Error('Receipt context release mismatch');
  const chainId = (receipt as TransactionReceipt & { chainId?: number }).chainId;
  if (chainId !== undefined && chainId !== context.chainId)
    throw new Error('Creation receipt chain mismatch');
  if (
    receipt.status !== 'success' ||
    !receipt.to ||
    factoryAddress(receipt.to) !== emitter ||
    receipt.blockNumber < context.startBlock
  )
    throw new Error('Invalid creation receipt');
  const transactionHash = factoryHash(receipt.transactionHash);
  const blockHash = factoryHash(receipt.blockHash);
  const creator = factoryAddress(input.account ?? receipt.from);
  if (factoryAddress(receipt.from) !== creator)
    throw new Error('Creation receipt account mismatch');
  const markets: Address[] = [];
  for (const log of receipt.logs) {
    if (factoryAddress(log.address) !== emitter) continue;
    if (
      log.removed ||
      log.blockNumber !== receipt.blockNumber ||
      log.transactionIndex !== receipt.transactionIndex ||
      log.transactionHash?.toLowerCase() !== transactionHash ||
      log.blockHash?.toLowerCase() !== blockHash
    )
      throw new Error('Creation log receipt identity mismatch');
    let event;
    try {
      event = decodeEventLog({
        abi: MarketFactoryAbi,
        data: log.data,
        topics: log.topics,
        strict: true,
      });
    } catch {
      continue;
    }
    if (event.eventName !== 'MarketCreated') continue;
    const args = event.args as unknown as { market: Address; creator: Address };
    if (factoryAddress(args.creator) !== creator)
      throw new Error('Creation event account mismatch');
    const market = factoryAddress(args.market);
    if (market === zeroAddress) throw new Error('Creation event contains zero market');
    markets.push(market);
  }
  if (markets.length !== 1)
    throw new Error('Expected exactly one authoritative MarketCreated event');
  return markets[0]!;
}
