import { encodeFunctionData, zeroAddress, type Abi, type Address, type Hex } from 'viem';
import { getFactoryAbis } from './factoryAbi/index.js';
import {
  factoryAddress,
  factoryHash,
  verifyFactoryOperation,
  type FactoryNodeContext,
  type FactoryRelease,
} from './factoryClient.js';
import { anchorReader, type AnchorEndpoint } from './factoryTrade/anchorClient.js';
import type { FactoryAmmConfig, FactoryLiquidityLimits } from './factoryTransactions.js';

/** The complete, consent-bound NodeTypes.Request tuple. */
export interface FactoryNodeRequest {
  releaseId: Hex;
  userSalt: Hex;
  requester: Address;
  nodeAdmin: Address;
  bookToken: Address;
  ammSurplusRecipient: Address;
  expiry: bigint;
  expectedBookPolicyVersion: number;
  expectedBookPolicyHash: Hex;
  ammConfig: FactoryAmmConfig;
}
export interface FactoryNodePreparationInput {
  release: FactoryRelease;
  endpoints: readonly AnchorEndpoint[];
  request: FactoryNodeRequest;
}
export type FactoryNodeLifecycleAction = {
  kind:
    | 'beginNode'
    | 'prepareNode'
    | 'completeNode'
    | 'activateNode'
    | 'approveRequest'
    | 'revokeRequest';
  request: FactoryNodeRequest;
};

async function nodeScope(input: FactoryNodePreparationInput) {
  const abis = getFactoryAbis(input.release);
  if (factoryHash(input.request.releaseId) !== factoryHash(input.release.releaseId))
    throw new Error('Node request release mismatch');
  const factory = factoryAddress(input.release.factory);
  const reader = anchorReader(input.release.chainId, input.endpoints);
  const blockNumber = await reader.getBlockNumber();
  if (blockNumber < BigInt(input.release.startBlock))
    throw new Error('Node request predates release');
  const read = (address: Address, abi: Abi, functionName: string, args: readonly unknown[] = []) =>
    reader.readContract({ address, abi, functionName, args, blockNumber });
  const registry = factoryAddress(await read(factory, abis.NodeFactoryAbi, 'registry'));
  const [id, hash, prediction] = await Promise.all([
    read(factory, abis.NodeFactoryAbi, 'nodeId', [input.request]),
    read(factory, abis.NodeFactoryAbi, 'requestHash', [input.request]),
    read(factory, abis.NodeFactoryAbi, 'predictNode', [input.request]),
  ]);
  const nodeId = factoryHash(id);
  const requestHash = factoryHash(hash);
  const predictedDeployer = factoryAddress((prediction as readonly unknown[])[0]);
  const [pendingValue, deployedValue, pendingHash] = await Promise.all([
    read(factory, abis.NodeFactoryAbi, 'pendingDeployer', [nodeId]),
    read(factory, abis.NodeFactoryAbi, 'nodeDeployer', [nodeId]),
    read(factory, abis.NodeFactoryAbi, 'pendingRequestHash', [nodeId]),
  ]);
  const pending = pendingValue === zeroAddress ? zeroAddress : factoryAddress(pendingValue);
  const deployed = deployedValue === zeroAddress ? zeroAddress : factoryAddress(deployedValue);
  const deployer = deployed !== zeroAddress ? deployed : pending;
  let prepared = false;
  let activated = false;
  if (deployer !== zeroAddress) {
    if (
      deployer !== predictedDeployer ||
      (pending !== zeroAddress && factoryHash(pendingHash) !== requestHash)
    )
      throw new Error('Node preparation request mismatch');
    const [actualFactory, actualRegistry, actualRelease, committedHash, isPrepared, isActivated] =
      await Promise.all([
        read(deployer, abis.NodeDeployerAbi, 'factory'),
        read(deployer, abis.NodeDeployerAbi, 'registry'),
        read(deployer, abis.NodeDeployerAbi, 'releaseId'),
        read(deployer, abis.NodeDeployerAbi, 'committedRequestHash'),
        read(deployer, abis.NodeDeployerAbi, 'prepared'),
        read(deployer, abis.NodeDeployerAbi, 'activated'),
      ]);
    if (
      factoryAddress(actualFactory) !== factory ||
      factoryAddress(actualRegistry) !== registry ||
      factoryHash(actualRelease) !== factoryHash(input.release.releaseId) ||
      factoryHash(committedHash) !== requestHash
    )
      throw new Error('Node deployer binding mismatch');
    prepared = isPrepared === true;
    activated = isActivated === true;
    if (activated && (await read(deployer, abis.NodeDeployerAbi, 'verifyWiring')) !== true)
      throw new Error('Activated node wiring mismatch');
  }
  return {
    abis,
    reader,
    read,
    factory,
    registry,
    blockNumber,
    nodeId,
    requestHash,
    predictedDeployer,
    deployer,
    pending: pending !== zeroAddress,
    deployed: deployed !== zeroAddress,
    prepared,
    activated,
  };
}

/** Observe the real preparation/activation state; completion activates atomically. */
export async function readFactoryNodePreparation(input: FactoryNodePreparationInput) {
  const {
    nodeId,
    requestHash,
    predictedDeployer,
    deployer,
    pending,
    deployed,
    prepared,
    activated,
    blockNumber,
  } = await nodeScope(input);
  return {
    nodeId,
    requestHash,
    predictedDeployer,
    deployer,
    pending,
    deployed,
    prepared,
    activated,
    blockNumber,
  };
}

/** prepareNode invokes beginNode; activateNode invokes completeNode, the sole activation path. */
export async function buildFactoryNodeTransaction(
  input: Omit<FactoryNodePreparationInput, 'request'> & {
    account: Address;
    action: FactoryNodeLifecycleAction;
  },
) {
  const scope = await nodeScope({ ...input, request: input.action.request });
  const { abis, reader, read, factory, registry, blockNumber, requestHash } = scope;
  const account = factoryAddress(input.account);
  const request = input.action.request;
  const functionName =
    input.action.kind === 'prepareNode'
      ? 'beginNode'
      : input.action.kind === 'activateNode'
        ? 'completeNode'
        : input.action.kind;
  const approval = functionName === 'approveRequest' || functionName === 'revokeRequest';
  if (!approval) {
    if (account !== factoryAddress(request.requester))
      throw new Error('Only the committed requester can deploy this node');
    if (functionName === 'beginNode' && (scope.pending || scope.deployed))
      throw new Error('Node is already prepared or deployed');
    if (
      functionName === 'completeNode' &&
      (!scope.pending || !scope.prepared || scope.deployed || scope.activated)
    )
      throw new Error('Node is not pending completion');
    // These are the exact stage-specific policy guards, including revocation.
    await read(
      registry,
      abis.ReleaseRegistryAbi,
      functionName === 'beginNode' ? 'validateActiveBookPolicy' : 'validateBookPolicy',
      [request.bookToken, request.expectedBookPolicyVersion, request.expectedBookPolicyHash],
    );
  }
  const args: readonly unknown[] = approval ? [requestHash] : [request];
  const abi: Abi = abis.NodeFactoryAbi;
  await reader.readContract({ address: factory, abi, functionName, args, account, blockNumber });
  return {
    chainId: input.release.chainId,
    account,
    address: factory,
    to: factory,
    abi,
    functionName,
    args,
    data: encodeFunctionData({ abi, functionName, args }),
    value: 0n as const,
    verifiedBlockNumber: blockNumber,
    nodeId: scope.nodeId,
    requestHash,
    predictedDeployer: scope.predictedDeployer,
  };
}

/** Native token funding and LP receipt limits bound to the exact quoted AMM state. */
export async function readFactoryLiquidityQuote(input: {
  context: FactoryNodeContext;
  endpoints: readonly AnchorEndpoint[];
  market: Address;
  additionalB: bigint;
  deadline: bigint;
  slippageBps?: number;
}) {
  const slippageBps = input.slippageBps ?? 0;
  if (
    input.additionalB <= 0n ||
    input.deadline <= 0n ||
    !Number.isInteger(slippageBps) ||
    slippageBps < 0 ||
    slippageBps >= 10_000
  )
    throw new Error('Invalid liquidity quote bounds');
  const { context, read } = await verifyFactoryOperation({
    identity: input.context,
    release: input.context.release,
    catalog: input.context.contracts,
    endpoints: input.endpoints,
    market: input.market,
  });
  const { AMMEngineAbi, TruthMarketAbi } = getFactoryAbis(context.release);
  if ((await read(input.market, TruthMarketAbi, 'isLiquidityOpen')) !== true)
    throw new Error('Market liquidity is closed');
  const marketDeadline = (await read(input.market, TruthMarketAbi, 'deadline')) as bigint;
  if (input.deadline > marketDeadline)
    throw new Error('Liquidity quote deadline exceeds market deadline');
  const [tokenIn, receiptUnits, price, stateHash] = (await read(
    context.contracts.amm,
    AMMEngineAbi,
    'quoteLiquidityWithState',
    [input.market, input.additionalB],
  )) as readonly [bigint, bigint, bigint, Hex];
  const margin = BigInt(slippageBps);
  const limits: FactoryLiquidityLimits = {
    maxTokenIn: (tokenIn * (10_000n + margin) + 9_999n) / 10_000n,
    minLpOut: (receiptUnits * (10_000n - margin)) / 10_000n,
    minYesPrice: (price * (10_000n - margin)) / 10_000n,
    maxYesPrice: (price * (10_000n + margin) + 9_999n) / 10_000n,
    deadline: input.deadline,
    expectedStateHash: factoryHash(stateHash),
  };
  if (
    limits.maxTokenIn <= 0n ||
    limits.maxTokenIn >= (1n << 256n) - 1n ||
    limits.minLpOut <= 0n ||
    limits.minYesPrice <= 0n ||
    limits.maxYesPrice >= 10n ** 18n ||
    limits.expectedStateHash === `0x${'0'.repeat(64)}`
  )
    throw new Error('Liquidity quote cannot produce bounded limits');
  return {
    tokenIn,
    receiptUnits,
    price,
    stateHash: limits.expectedStateHash,
    limits,
    blockNumber: context.blockNumber,
    context,
  };
}
