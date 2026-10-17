import { readFile } from 'node:fs/promises';
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  parseEventLogs,
  type Address,
  type Hex,
  type PublicClient,
  type TransactionReceipt,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  factoryAddress,
  factoryHash,
  factoryReadClient,
  verifyFactoryNode,
  readFactoryMarketSnapshot,
  readFactoryPositions,
  readFactoryBookInventory,
  readFactoryQuote,
  type FactoryNodeContext,
} from '../factory/factoryClient.js';
import {
  buildFactoryTransaction,
  decodeFactoryCreatedMarket,
  type FactoryTransactionAction,
  type FactoryTransactionInput,
  type FactoryTransactionRequest,
} from '../factory/factoryTransactions.js';
import { fetchFactoryCatalogNodes, fetchFactoryCatalogMarkets } from '../factory/factoryCatalog.js';
import {
  parseFactoryAdjudicatorBinding,
  type FactoryAdjudicatorBinding,
} from '../factory/adjudicators.js';
import { getFactoryAbis } from '../factory/factoryAbi/index.js';
import { assertFactoryTransactionReceipt } from '../factory/factoryReceipt.js';
import { assertSupportedFactoryRelease } from '../factory/releases.js';
import { awaitReceipt, ReceiptNotSeenError } from '../factory/factoryTrade/receiptWait.js';
import type { AnchorEndpoint } from '../factory/factoryTrade/anchorClient.js';
import {
  HELP,
  actionShapes,
  commandAction,
  integerAmount,
  object,
  parseCliArgs,
  parseRelease,
  required,
  safeInteger,
} from './arguments.js';

export interface CliIO {
  stdout(text: string): void;
  stderr(text: string): void;
  readJson(path: string): Promise<unknown>;
  env(name: string): string | undefined;
}
const defaultIO: CliIO = {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
  readJson: async (path) => {
    if (path !== '-') return JSON.parse(await readFile(path, 'utf8'));
    let text = '';
    for await (const chunk of process.stdin) text += String(chunk);
    return JSON.parse(text);
  },
  env: (name) => process.env[name],
};
export function json(value: unknown): string {
  return (
    JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item), 2) +
    '\n'
  );
}
function rpcUrl(value: string): string {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw new Error('RPC must be an HTTP(S) URL without embedded credentials');
  return url.toString();
}
function same(left: string | null, right: string): boolean {
  return left?.toLowerCase() === right.toLowerCase();
}

/** A mined success is reported only after the actual transaction is correlated. */
export async function inspectReceipt(
  client: PublicClient,
  hash: Hex,
  request: FactoryTransactionRequest,
  receipt: TransactionReceipt,
) {
  const [transaction, chainId, block] = await Promise.all([
    client.getTransaction({ hash }),
    client.getChainId(),
    client.getBlock({ blockNumber: receipt.blockNumber }),
  ]);
  assertFactoryTransactionReceipt(request, hash, chainId, transaction, receipt, block);
  const events = parseEventLogs({
    abi: request.abi,
    logs: receipt.logs.filter((log) => same(log.address, request.to)),
    strict: true,
  });
  return { receipt, events };
}

interface ExecutionContext {
  context: FactoryNodeContext;
  endpoints: readonly AnchorEndpoint[];
  client: PublicClient;
  account: Address;
  market?: Address;
  adjudicatorBinding?: FactoryAdjudicatorBinding;
}
async function build(execution: ExecutionContext, action: FactoryTransactionAction) {
  // Every signing request, including a reset approval, gets a new verified scope.
  return buildFactoryTransaction({
    context: execution.context,
    endpoints: execution.endpoints,
    account: execution.account,
    market: execution.market,
    adjudicatorBinding: execution.adjudicatorBinding,
    action,
  } as FactoryTransactionInput);
}
async function simulate(client: PublicClient, request: FactoryTransactionRequest) {
  return client.simulateContract({
    address: request.address,
    abi: request.abi,
    functionName: request.functionName,
    args: request.args,
    account: request.account,
  });
}

export async function runCli(args: string[], io: CliIO = defaultIO): Promise<number> {
  let pendingHash: Hex | undefined;
  try {
    const { command, flags } = parseCliArgs(args);
    if (command === 'help') {
      io.stdout(HELP);
      return 0;
    }
    if (command === 'actions') {
      io.stdout(
        json({
          units: {
            uint: 'unsigned decimal integer string',
            int: 'signed decimal integer string',
            number: 'JSON integer',
            hash: 'full bytes32',
          },
          actions: actionShapes,
        }),
      );
      return 0;
    }
    const chainId = safeInteger(required(flags.chain, 'chain'), 'chain');
    const factory = factoryAddress(required(flags.factory, 'factory'));
    const releaseFile = object(
      await io.readJson(required(flags.release, 'release')),
      'release file',
    );
    const releases = Array.isArray(releaseFile.releases)
      ? releaseFile.releases.filter((value) => {
          const entry = object(value, 'release');
          return (
            entry.chainId === chainId &&
            typeof entry.factory === 'string' &&
            same(entry.factory, factory)
          );
        })
      : [releaseFile];
    if (releases.length !== 1)
      throw new Error('Release file must select exactly one release for this chain and factory');
    const release = parseRelease(releases[0]);
    if (release.chainId !== chainId || !same(release.factory, factory))
      throw new Error('Release file does not match --chain and --factory');
    assertSupportedFactoryRelease(release);
    if (command === 'nodes') {
      const page = await fetchFactoryCatalogNodes(chainId, factory, {
        baseUrl: required(flags.catalog, 'catalog'),
        maxPages: safeInteger(flags['max-pages'] ?? '100', 'max-pages'),
      });
      io.stdout(json({ release, ...page }));
      return 0;
    }
    const identity = { chainId, factory, nodeId: factoryHash(required(flags.node, 'node')) };
    if (command === 'markets') {
      const page = await fetchFactoryCatalogMarkets(identity, {
        baseUrl: required(flags.catalog, 'catalog'),
        maxPages: safeInteger(flags['max-pages'] ?? '100', 'max-pages'),
      });
      io.stdout(json({ release, ...page }));
      return 0;
    }
    const urls = flags.rpc?.map(rpcUrl) ?? [];
    if (new Set(urls).size < 2)
      throw new Error(
        'At least two independent --rpc endpoints are required by Factory verification',
      );
    const chain = defineChain({
      id: chainId,
      name: `Factory ${chainId}`,
      nativeCurrency: { name: 'Native', symbol: 'ETH', decimals: 18 },
      rpcUrls: { default: { http: urls } },
    });
    const clients = urls.map(
      (url) => createPublicClient({ chain, transport: http(url) }) as PublicClient,
    );
    const client = clients[0]!;
    const endpoints: AnchorEndpoint[] = clients.map((rpc, index) => ({
      url: urls[index]!,
      reader: factoryReadClient(rpc),
    }));
    const context = await verifyFactoryNode({ identity, release, endpoints });
    if (command === 'identity') {
      io.stdout(json(context));
      return 0;
    }
    const venue = required(flags.venue, 'venue');
    if (venue !== 'amm' && venue !== 'book') throw new Error('--venue must be amm or book');
    const market = flags.market ? factoryAddress(flags.market) : undefined;
    const account = flags.account ? factoryAddress(flags.account) : undefined;
    const reader = factoryReadClient(client);
    if (command === 'read' || command === 'quote') {
      if (!market) throw new Error('--market is required');
      const scope = { context, client: reader, market, blockNumber: context.blockNumber };
      if (command === 'quote') {
        if (venue !== 'amm') throw new Error('AMM quote requires --venue amm');
        const outcome = safeInteger(required(flags.outcome, 'outcome'), 'outcome', 0);
        if (outcome !== 0 && outcome !== 1) throw new Error('--outcome must be 0 or 1');
        io.stdout(
          json(
            await readFactoryQuote({
              ...scope,
              outcome,
              deltaShares: integerAmount(required(flags.shares, 'shares'), 'shares', true),
            }),
          ),
        );
      } else {
        const snapshot = await readFactoryMarketSnapshot(scope);
        const positions = account
          ? await readFactoryPositions({ ...scope, account, markets: [market] })
          : undefined;
        const book = account ? await readFactoryBookInventory({ ...scope, account }) : undefined;
        io.stdout(json({ identity, release, venue, snapshot, positions, book }));
      }
      return 0;
    }
    if (!account) throw new Error('--account is required for preparation and signing');
    if (flags.receipt) {
      const hash = factoryHash(flags.receipt);
      const saved = object(await io.readJson(required(flags.input, 'input')), 'saved submission');
      const original = object(saved.request, 'saved request');
      const originalContext = object(original.verifiedContext, 'saved context');
      const originalRelease = object(originalContext.release, 'saved release');
      if (
        saved.hash !== hash ||
        original.chainId !== chainId ||
        factoryAddress(original.account) !== account ||
        factoryAddress(originalContext.factory) !== factory ||
        factoryHash(originalContext.nodeId) !== identity.nodeId ||
        factoryHash(originalRelease.releaseId) !== release.releaseId ||
        saved.venue !== venue ||
        (saved.market === undefined
          ? market !== undefined
          : factoryAddress(saved.market) !== market)
      )
        throw new Error('Saved submission differs from selected transaction identity');
      if (
        typeof original.data !== 'string' ||
        !/^0x(?:[\da-f]{2})*$/i.test(original.data) ||
        original.value !== '0' ||
        !Array.isArray(original.abi)
      )
        throw new Error('Invalid saved request');
      const request = {
        ...original,
        chainId,
        account,
        to: factoryAddress(original.to),
        data: original.data as Hex,
        value: 0n,
        verifiedContext: context,
      } as FactoryTransactionRequest;
      pendingHash = hash;
      const receipt = await client.getTransactionReceipt({ hash });
      const result = await inspectReceipt(client, hash, request, receipt);
      pendingHash = undefined;
      io.stdout(json({ status: receipt.status, ...result }));
      if (receipt.status === 'success' && request.functionName === 'createMarket')
        io.stdout(
          json({
            status: 'created',
            market: decodeFactoryCreatedMarket({ receipt, context, account }),
          }),
        );
      return receipt.status === 'success' ? 0 : 1;
    }
    const value =
      command === 'settle' ? undefined : await io.readJson(required(flags.input, 'input'));
    const action = commandAction(command, value, venue);
    const nodeActions = [
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
    ];
    if (!market && !nodeActions.includes(action.kind))
      throw new Error('--market is required for this action');
    if (action.kind === 'createMarket' && market)
      throw new Error('Creation has no existing --market; use the mined MarketCreated event');
    const adjudicatorBinding = flags.adjudicator
      ? parseFactoryAdjudicatorBinding(await io.readJson(flags.adjudicator))
      : undefined;
    const execution: ExecutionContext = {
      context,
      endpoints,
      client,
      account,
      market,
      adjudicatorBinding,
    };
    if (!flags.send) {
      const request = await build(execution, action);
      const simulation = await simulate(client, request);
      io.stdout(
        json({
          mode: 'prepared',
          identity,
          release,
          market,
          venue,
          action,
          request,
          simulation: simulation.result,
        }),
      );
      return 0;
    }
    const envName = required(flags['wallet-env'], 'wallet-env');
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(envName))
      throw new Error('--wallet-env must name an environment variable');
    const privateKey = io.env(envName);
    if (!privateKey || !/^0x[\da-f]{64}$/i.test(privateKey))
      throw new Error('Selected wallet environment variable must contain a hex private key');
    const signer = privateKeyToAccount(privateKey as Hex);
    if (!same(signer.address, account)) throw new Error('Selected wallet differs from --account');
    const wallet = createWalletClient({ account: signer, chain, transport: http(urls[0]!) });
    const timeoutMs = safeInteger(flags['timeout-ms'] ?? '120000', 'timeout-ms');
    const submit = async (prepared: FactoryTransactionRequest) => {
      if ((await client.getChainId()) !== chainId || (await wallet.getChainId()) !== chainId)
        throw new Error('Wallet or RPC chain changed before signing');
      await simulate(client, prepared);
      const hash = await wallet.sendTransaction({
        account: signer,
        chain,
        to: prepared.to,
        data: prepared.data,
        value: prepared.value,
      });
      pendingHash = hash;
      io.stdout(
        json({
          status: 'submitted',
          hash,
          chainId,
          factory,
          nodeId: identity.nodeId,
          market,
          venue,
          account,
          request: prepared,
        }),
      );
      const receipt = await awaitReceipt({
        hash,
        budgetMs: timeoutMs,
        wait: (budget) => client.waitForTransactionReceipt({ hash, timeout: budget }),
        sources: clients.map((rpc, index) => ({
          name: `rpc-${index + 1}`,
          getTransactionReceipt: (transactionHash: Hex) =>
            rpc.getTransactionReceipt({ hash: transactionHash }),
        })),
      });
      const result = await inspectReceipt(client, hash, prepared, receipt);
      pendingHash = undefined;
      io.stdout(json({ status: receipt.status, ...result }));
      if (receipt.status !== 'success') throw new Error(`Transaction reverted: ${hash}`);
      return receipt;
    };
    if (flags['zero-first']) {
      if (action.kind !== 'approve' && action.kind !== 'approveCreation')
        throw new Error('--zero-first applies only to explicit approval actions');
      await submit(await build(execution, { ...action, amountNative: 0n }));
    }
    const request = await build(execution, action);
    const receipt = await submit(request);
    if (action.kind === 'createMarket')
      io.stdout(
        json({
          status: 'created',
          market: decodeFactoryCreatedMarket({
            receipt,
            context: request.verifiedContext,
            account,
          }),
        }),
      );
    if (action.kind === 'cancelOrder') {
      const order = await client.readContract({
        address: request.verifiedContext.contracts.book,
        abi: getFactoryAbis(request.verifiedContext.release).OrderEngineAbi,
        functionName: 'getOrder',
        args: [action.orderId],
        blockNumber: receipt.blockNumber,
      });
      io.stdout(
        json({
          status: 'reconciled',
          orderId: action.orderId,
          blockNumber: receipt.blockNumber,
          order,
        }),
      );
    }
    return 0;
  } catch (error) {
    const status = pendingHash || error instanceof ReceiptNotSeenError ? 'pending' : 'error';
    io.stderr(
      json({
        status,
        ...(pendingHash ? { hash: pendingHash } : {}),
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    return status === 'pending' ? 2 : 1;
  }
}
