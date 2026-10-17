/** Factory-only client primitives. No wallet framework or legacy SDK imports. */
import { erc20Abi, type Abi, type Address, type Hex, type PublicClient } from 'viem';
import { getFactoryAbis } from './factoryAbi/index.js';
import { anchorReader, type AnchorEndpoint } from './factoryTrade/anchorClient.js';
import { deriveNodeChildren, type NodeChildren } from './factoryTrade/nodeChildren.js';
import type { AmmQuote } from './factoryTrade/ammTradePlan.js';
import { settledOutcomeOnChain } from './factoryTrade/settlement.js';
import {
  factoryAddress,
  factoryHash,
  factoryNodeKey,
  type FactoryIdentity,
} from './schemaIdentity.js';
export {
  factoryAddress,
  factoryHash,
  factoryNodeKey,
  factoryMarketKey,
  type FactoryIdentity,
} from './schemaIdentity.js';

/** Supply releases pinned by the build, never taken from an untrusted catalog. */
export interface FactoryRelease {
  chainId: number;
  factory: Address;
  releaseId: Hex;
  interfaceVersion: string;
  startBlock: number;
  sdkAbiHash?: Hex;
}
export interface BindingRead {
  address: Address;
  abi: readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
  blockNumber?: bigint;
  account?: Address;
}
export interface BindingReader {
  getBlockNumber(): Promise<bigint>;
  readContract(call: BindingRead): Promise<unknown>;
}
export interface FactoryReadClient extends BindingReader {
  getChainId(): Promise<number>;
  getBlock?(input: { blockNumber: bigint }): Promise<{ number: bigint; timestamp: bigint }>;
  simulateContract?(call: BindingRead & { account: Address }): Promise<{ result: unknown }>;
  /** Calls execute in order against shared temporary state; never broadcasts. */
  simulateSequence?(input: {
    account: Address;
    blockNumber: bigint;
    calls: readonly BindingRead[];
  }): Promise<readonly unknown[]>;
}
export interface FactoryNodeContext extends FactoryIdentity {
  release: FactoryRelease;
  contracts: NodeChildren & { deployer: Address };
  startBlock: bigint;
  blockNumber: bigint;
}
export type FactoryOutcome = 0 | 1 | 2;
export const FACTORY_OUTCOME = { NO: 0, YES: 1, INVALID: 2 } as const;
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Adapt a viem public client without losing its transport or requiring wagmi. */
export function factoryReadClient(client: PublicClient): FactoryReadClient {
  return {
    getChainId: () => client.getChainId(),
    getBlockNumber: () => client.getBlockNumber({ cacheTime: 0 }),
    readContract: (call) =>
      client.readContract(call as Parameters<PublicClient['readContract']>[0]),
    getBlock: (input) => client.getBlock(input),
    simulateContract: (call) =>
      client.simulateContract(call as Parameters<PublicClient['simulateContract']>[0]),
    simulateSequence: async (input) => {
      const result = await client.simulateCalls({
        account: input.account,
        blockNumber: input.blockNumber,
        calls: input.calls.map((call) => ({
          to: call.address,
          abi: call.abi as Abi,
          functionName: call.functionName,
          args: call.args,
        })),
      });
      return result.results.map((call) => {
        if (call.status !== 'success') throw call.error;
        return call.result;
      });
    },
  };
}

export interface VerifyFactoryNodeInput {
  identity: FactoryIdentity;
  release: FactoryRelease;
  /** Independent, build-pinned transports; never a catalog-provided URL. */
  endpoints: readonly AnchorEndpoint[];
  catalog?: Partial<NodeChildren & { deployer: Address; truthImplementation: Address }>;
}

/** Fresh scope for one operation; its node, market and action reads share one quorum and head. */
export async function verifyFactoryOperation(input: VerifyFactoryNodeInput & { market?: Address }) {
  const { identity, release } = input;
  const {
    AMMEngineAbi,
    AmmFeeVaultAbi,
    BookFeeVaultAbi,
    LPPositionManagerAbi,
    MarketFactoryAbi,
    NodeFactoryAbi,
    NodeDeployerAbi,
    OrderEngineAbi,
    TruthMarketAbi,
  } = getFactoryAbis(release);
  factoryNodeKey(identity);
  if (release.chainId !== identity.chainId || !same(release.factory, identity.factory))
    throw new Error('Release does not bind this chain and factory');
  factoryHash(release.releaseId);
  if (!Number.isSafeInteger(release.startBlock) || release.startBlock < 0)
    throw new Error('Invalid release start block');
  const reader = anchorReader(identity.chainId, input.endpoints);
  const blockNumber = await reader.getBlockNumber();
  const read = (address: Address, abi: Abi, functionName: string, args: readonly unknown[] = []) =>
    reader.readContract({ address, abi, functionName, args, blockNumber });
  const deployer = factoryAddress(
    await read(identity.factory, NodeFactoryAbi, 'nodeDeployer', [identity.nodeId]),
  );
  const contracts = { ...deriveNodeChildren(deployer), deployer };
  const releaseCheck = async () => {
    const actualRelease = factoryHash(await read(deployer, NodeDeployerAbi, 'releaseId'));
    if (!same(actualRelease, release.releaseId))
      throw new Error('Node release differs from the release pinned for this factory');
  };
  const { truthImplementation, ...catalog } = input.catalog ?? {};
  for (const key of Object.keys(catalog) as (keyof typeof contracts)[]) {
    if (!contracts[key] || !same(factoryAddress(catalog[key]), contracts[key]))
      throw new Error(`Catalog ${key} differs from the verified node`);
  }
  const checks: [Address, Abi, string, Address][] = [
    [contracts.amm, AMMEngineAbi, 'marketFactory', contracts.marketFactory],
    [contracts.book, OrderEngineAbi, 'marketFactory', contracts.marketFactory],
    [contracts.marketFactory, MarketFactoryAbi, 'ammEngine', contracts.amm],
    [contracts.marketFactory, MarketFactoryAbi, 'orderEngine', contracts.book],
    [contracts.amm, AMMEngineAbi, 'feeVault', contracts.ammVault],
    [contracts.book, OrderEngineAbi, 'feeVault', contracts.bookVault],
    [contracts.amm, AMMEngineAbi, 'positionManager', contracts.positionManager],
    [contracts.positionManager, LPPositionManagerAbi, 'engine', contracts.amm],
    [contracts.positionManager, LPPositionManagerAbi, 'vault', contracts.ammVault],
    [contracts.ammVault, AmmFeeVaultAbi, 'roles', contracts.roles],
    [contracts.bookVault, BookFeeVaultAbi, 'roles', contracts.roles],
  ];
  await Promise.all([
    releaseCheck(),
    ...checks.map(async ([address, abi, functionName, expected]) => {
      if (!same(factoryAddress(await read(address, abi, functionName)), expected))
        throw new Error(`Node binding failed at ${functionName}`);
    }),
    ...(truthImplementation
      ? [
          (async () => {
            if (
              !same(
                factoryAddress(
                  await read(contracts.marketFactory, MarketFactoryAbi, 'truthMarketImpl'),
                ),
                factoryAddress(truthImplementation),
              )
            )
              throw new Error('Catalog truth implementation differs from the verified node');
          })(),
        ]
      : []),
  ]);
  const context: FactoryNodeContext = {
    ...identity,
    release: { ...release },
    contracts,
    startBlock: BigInt(release.startBlock),
    blockNumber,
  };
  let marketBinding: { market: Address; adjudicator: Address } | undefined;
  if (input.market !== undefined) {
    const market = factoryAddress(input.market);
    const [marketFactory, adjudicator] = await Promise.all([
      read(market, TruthMarketAbi, 'marketFactory'),
      read(market, TruthMarketAbi, 'adjudicator'),
    ]);
    if (!same(factoryAddress(marketFactory), contracts.marketFactory))
      throw new Error('Market belongs to another node');
    marketBinding = { market, adjudicator: factoryAddress(adjudicator) };
  }
  return { context, reader, read, marketBinding };
}

export async function verifyFactoryNode(
  input: VerifyFactoryNodeInput,
): Promise<FactoryNodeContext> {
  return (await verifyFactoryOperation(input)).context;
}

/** Revalidate the node and market immediately before each signature, including approvals. */
export async function assertMarketBinding(input: VerifyFactoryNodeInput & { market: Address }) {
  const { context, marketBinding } = await verifyFactoryOperation(input);
  if (!marketBinding) throw new Error('Market binding required');
  return { ...context, ...marketBinding };
}

export interface FactoryReadParams {
  context: FactoryNodeContext;
  client: FactoryReadClient;
  blockNumber?: bigint;
}
export interface FactoryMarketParams extends FactoryReadParams {
  market: Address;
}
export interface FactoryAccountParams extends FactoryMarketParams {
  account: Address;
}
export async function factoryReadScope(input: FactoryReadParams) {
  const abis = getFactoryAbis(input.context.release);
  if ((await input.client.getChainId()) !== input.context.chainId)
    throw new Error('RPC chain differs from the Factory identity');
  const blockNumber = input.blockNumber ?? (await input.client.getBlockNumber());
  const read = <T>(
    address: Address,
    abi: Abi,
    functionName: string,
    args: readonly unknown[] = [],
  ) => input.client.readContract({ address, abi, functionName, args, blockNumber }) as Promise<T>;
  return { blockNumber, read, abis };
}
export async function factoryMarketScope(input: FactoryMarketParams) {
  const scope = await factoryReadScope(input);
  const actual = await scope.read<Address>(
    input.market,
    scope.abis.TruthMarketAbi,
    'marketFactory',
  );
  if (!same(factoryAddress(actual), input.context.contracts.marketFactory))
    throw new Error('Market belongs to another node');
  return scope;
}

export async function readFactoryMarketSnapshot(input: FactoryMarketParams) {
  const {
    blockNumber,
    read,
    abis: { AMMEngineAbi, OrderEngineAbi, AmmFeeVaultAbi, BookFeeVaultAbi, TruthMarketAbi },
  } = await factoryMarketScope(input);
  const { amm, book, ammVault, bookVault } = input.context.contracts;
  const m = [input.market];
  const [
    state,
    tokenA,
    tokenADecimals,
    bookToken,
    bookTokenDecimals,
    shareUnit,
    ammFeeBps,
    bookFeeBps,
    tradingOpen,
    liquidityOpen,
    settled,
    winningOutcome,
    deadline,
    startTime,
    invalidationBuffer,
    adjudicator,
    phase,
    isAttested,
    isResolving,
    settlementKind,
  ] = await Promise.all([
    read<readonly [bigint, bigint, bigint]>(amm, AMMEngineAbi, 'getMarketState', m),
    read<Address>(amm, AMMEngineAbi, 'tokenAOf', m),
    read<number>(amm, AMMEngineAbi, 'tokenADecimalsOf', m),
    read<Address>(book, OrderEngineAbi, 'baseToken'),
    read<number>(book, OrderEngineAbi, 'baseTokenDecimals'),
    read<bigint>(book, OrderEngineAbi, 'shareUnit'),
    read<number>(ammVault, AmmFeeVaultAbi, 'feeBpsOf', m),
    read<number>(bookVault, BookFeeVaultAbi, 'feeBpsOf', m),
    read<boolean>(input.market, TruthMarketAbi, 'isTradingOpen'),
    read<boolean>(input.market, TruthMarketAbi, 'isLiquidityOpen'),
    read<boolean>(input.market, TruthMarketAbi, 'isSettled'),
    read<number>(input.market, TruthMarketAbi, 'winningOutcome'),
    read<bigint>(input.market, TruthMarketAbi, 'deadline'),
    read<bigint>(input.market, TruthMarketAbi, 'startTime'),
    read<bigint>(input.market, TruthMarketAbi, 'invalidationBuffer'),
    read<Address>(input.market, TruthMarketAbi, 'adjudicator'),
    read<number>(input.market, TruthMarketAbi, 'state'),
    read<boolean>(input.market, TruthMarketAbi, 'isAttested'),
    read<boolean>(input.market, TruthMarketAbi, 'isResolving'),
    read<number>(input.market, TruthMarketAbi, 'settlementKind'),
  ]);
  if (![0, 1, 2].includes(Number(winningOutcome))) throw new Error('Invalid outcome encoding');
  for (const decimals of [tokenADecimals, bookTokenDecimals])
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18)
      throw new Error('Unsupported token decimals');
  const block = input.client.getBlock ? await input.client.getBlock({ blockNumber }) : null;
  return {
    market: input.market,
    blockNumber,
    blockTimestamp: block?.timestamp ?? null,
    startTime,
    invalidationBuffer,
    permissionlessInvalidationAt: deadline + invalidationBuffer,
    adjudicator,
    phase,
    isAttested,
    isResolving,
    settlementKind,
    qYes: state[0],
    qNo: state[1],
    yesPriceWad: state[2],
    tokenA: factoryAddress(tokenA),
    tokenADecimals,
    bookToken: factoryAddress(bookToken),
    bookTokenDecimals,
    shareUnit,
    ammFeeBps,
    bookFeeBps,
    tradingOpen,
    liquidityOpen,
    settled,
    outcome: settledOutcomeOnChain(settled, winningOutcome, settlementKind),
    deadline,
  };
}
export type FactoryMarketSnapshot = Awaited<ReturnType<typeof readFactoryMarketSnapshot>>;

export async function readFactoryPositions(
  input: FactoryReadParams & { markets: readonly Address[]; account: Address },
) {
  const { blockNumber } = await factoryReadScope(input);
  const positions = [];
  for (const market of input.markets) {
    const {
      read,
      abis: { AMMEngineAbi },
    } = await factoryMarketScope({ ...input, market, blockNumber });
    const [yes, no] = await read<readonly [bigint, bigint]>(
      input.context.contracts.amm,
      AMMEngineAbi,
      'getPosition',
      [market, input.account],
    );
    positions.push({ market, account: input.account, yes, no, blockNumber });
  }
  return { blockNumber, positions, complete: true as const };
}

export async function readFactoryBookInventory(input: FactoryAccountParams) {
  const {
    blockNumber,
    read,
    abis: { OrderEngineAbi },
  } = await factoryMarketScope(input);
  const { book } = input.context.contracts;
  const bookToken = factoryAddress(await read<Address>(book, OrderEngineAbi, 'baseToken'));
  const [inventory, balance, allowance, bookTokenDecimals, shareUnit] = await Promise.all([
    read<readonly [bigint, bigint, bigint, bigint, bigint]>(book, OrderEngineAbi, 'getInventory', [
      input.market,
      input.account,
    ]),
    read<bigint>(bookToken, erc20Abi, 'balanceOf', [input.account]),
    read<bigint>(bookToken, erc20Abi, 'allowance', [input.account, book]),
    read<number>(book, OrderEngineAbi, 'baseTokenDecimals'),
    read<bigint>(book, OrderEngineAbi, 'shareUnit'),
  ]);
  const [yesOwned, noOwned, yesReserved, noReserved, cashReserved] = inventory;
  return {
    blockNumber,
    account: input.account,
    bookToken,
    bookTokenDecimals,
    shareUnit,
    yesOwned,
    noOwned,
    yesReserved,
    noReserved,
    cashReserved,
    balance,
    allowance,
  };
}

export async function readFactoryQuote(
  input: FactoryMarketParams & { outcome: 0 | 1; deltaShares: bigint },
): Promise<AmmQuote & { blockNumber: bigint }> {
  if ((input.outcome !== 0 && input.outcome !== 1) || input.deltaShares === 0n)
    throw new Error('Invalid quote input');
  const {
    blockNumber,
    read,
    abis: { AMMEngineAbi },
  } = await factoryMarketScope(input);
  const [costWad, feeWad, netWad, newPriceWad] = await read<
    readonly [bigint, bigint, bigint, bigint]
  >(input.context.contracts.amm, AMMEngineAbi, 'getPositionQuote', [
    input.market,
    input.outcome,
    input.deltaShares,
  ]);
  return { blockNumber, costWad, feeWad, netWad, newPriceWad };
}

export * from './factoryPortfolio.js';
export * from './factoryTransactions.js';
export * from './factoryCatalog.js';
export * from './factoryIndexer.js';
export * from './factoryLifecycle.js';
export * from './factoryReceipt.js';
