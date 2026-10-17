import { erc20Abi, parseUnits, zeroHash, type Address, type Hex } from 'viem';
import { getFactoryAbis, ManualAdjudicatorAbi } from '../factory/factoryAbi/index.js';
import {
  verifyFactoryOperation,
  factoryReadClient,
  type FactoryNodeContext,
} from '../factory/factoryClient.js';
import {
  readFactoryAdjudicatorBinding,
  type FactoryAdjudicatorBinding,
} from '../factory/adjudicators.js';
import {
  buildFactoryTransaction,
  type FactoryCreationParams,
  type FactoryAmmConfig,
  type FactoryBookConfig,
} from '../factory/factoryTransactions.js';
import { buildResolutionTerms, type ResolutionConfig } from '../factory/creationTerms.js';
import { generateSQF } from '../lib/sqf.js';
import type { SoothResolvedNode } from './runtime.js';
import { formatSoothNodeReference } from './node.js';
import { canPersistSoothPending, type SoothWalletAdapter } from './wallet.js';
import {
  loadSoothPendingCreations,
  saveSoothPendingCreation,
  reconcileSoothCreation,
  type SoothPendingCreation,
} from './creationRecovery.js';

export interface SoothCreationProfile {
  binding: FactoryAdjudicatorBinding;
  resolvers: readonly Address[];
  vetoPeriod: number;
  earlyResolution: boolean;
}
export interface SoothCreationOptions {
  context: FactoryNodeContext;
  paused: boolean;
  walletMayCreate: boolean;
  tokens: { address: Address; decimals: number; symbol: string }[];
  profiles: SoothCreationProfile[];
  unavailable: { address: Address; reason: string }[];
}
export interface SoothCreationIntent {
  question: string;
  rules: string;
  deadline: bigint;
  token: Address;
  adjudicator: Address;
  resolver: Address;
  /** AMM liquidity depth, in token units (18 digit WAD precision). */
  liquidity: string;
  /** Explicit maximum debit in collateral units, never an estimated spend. */
  budget: string;
  /** Initial YES probability in percent. */
  probability: string;
  resolution: ResolutionConfig;
}
export interface SoothCreationPreview {
  node: string;
  account: Address;
  intent: SoothCreationIntent;
  context: FactoryNodeContext;
  params: FactoryCreationParams;
  profile: SoothCreationProfile;
  token: SoothCreationOptions['tokens'][number];
  balance: bigint;
  allowance: bigint;
  approveNative: bigint | null;
  ammConfig: FactoryAmmConfig;
  bookConfig: FactoryBookConfig;
}
function reason(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to verify this creation option.';
}
/** Catalog values only discover candidates; every usable capability comes from verified live reads. */
export async function readSoothCreationOptions(
  node: SoothResolvedNode,
  account?: Address,
): Promise<SoothCreationOptions> {
  const { context, read, reader } = await verifyFactoryOperation({
    identity: node.reference,
    release: node.context.release,
    endpoints: node.endpoints,
    catalog: node.context.contracts,
  });
  const { MarketFactoryAbi, NodeRolesAbi } = getFactoryAbis(context.release);
  const c = context.contracts;
  const [paused, permissionless, admin, allowed] = await Promise.all([
    read(c.marketFactory, MarketFactoryAbi, 'creationPaused') as Promise<boolean>,
    read(c.marketFactory, MarketFactoryAbi, 'permissionlessCreation') as Promise<boolean>,
    read(c.roles, NodeRolesAbi, 'nodeAdmin') as Promise<Address>,
    account
      ? (read(c.marketFactory, MarketFactoryAbi, 'allowedCreators', [account]) as Promise<boolean>)
      : false,
  ]);
  const state = node.node.state;
  if (!state) throw new Error('The node catalog has no creation candidates yet. Refresh the node.');
  const tokenResults = await Promise.allSettled(
    state.creation.tokens.map(async (address) => {
      if (!(await read(c.marketFactory, MarketFactoryAbi, 'allowedTokens', [address])))
        throw new Error('Collateral is no longer admitted.');
      const [decimals, symbol] = await Promise.all([
        read(address, erc20Abi, 'decimals') as Promise<number>,
        read(address, erc20Abi, 'symbol') as Promise<string>,
      ]);
      if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18)
        throw new Error('Collateral precision is unsupported.');
      return { address, decimals, symbol };
    }),
  );
  const profileResults = await Promise.allSettled(
    state.creation.adjudicators.map(async (candidate) => {
      const binding = await readFactoryAdjudicatorBinding(
        { ...reader, getChainId: async () => context.chainId },
        {
          address: candidate.adjudicator,
          profileHash: candidate.profileHash,
          marketFactory: c.marketFactory,
          chainId: context.chainId,
        },
        { blockNumber: context.blockNumber },
      );
      if (binding.kind === 'imd-v2')
        throw new Error(
          'Legacy IMD does not verify the SQF semantic binding. Select an admitted IMD SQF profile.',
        );
      if (binding.kind === 'swarm-expert-sqf')
        throw new Error(
          'This profile requires a host-provided Swarm mandate and is not available for interactive creation.',
        );
      const [resolvers, vetoPeriod, earlyResolution] = await Promise.all([
        read(binding.address, ManualAdjudicatorAbi, 'resolvers') as Promise<readonly Address[]>,
        read(binding.address, ManualAdjudicatorAbi, 'vetoPeriod') as Promise<number>,
        read(binding.address, ManualAdjudicatorAbi, 'earlyResolution') as Promise<boolean>,
      ]);
      if (!resolvers.length) throw new Error('This profile has no approved resolver.');
      return { binding, resolvers, vetoPeriod: Number(vetoPeriod), earlyResolution };
    }),
  );
  const tokens: SoothCreationOptions['tokens'] = [],
    profiles: SoothCreationProfile[] = [],
    unavailable: SoothCreationOptions['unavailable'] = [];
  tokenResults.forEach((result, i) =>
    result.status === 'fulfilled'
      ? tokens.push(result.value)
      : unavailable.push({ address: state.creation.tokens[i]!, reason: reason(result.reason) }),
  );
  profileResults.forEach((result, i) =>
    result.status === 'fulfilled'
      ? profiles.push(result.value)
      : unavailable.push({
          address: state.creation.adjudicators[i]!.adjudicator,
          reason: reason(result.reason),
        }),
  );
  return {
    context,
    paused,
    walletMayCreate:
      !!account &&
      !paused &&
      (permissionless || allowed || admin.toLowerCase() === account.toLowerCase()),
    tokens,
    profiles,
    unavailable,
  };
}
function amount(value: string, decimals: number, label: string): bigint {
  if (
    !new RegExp(`^\\d+(?:\\.\\d{1,${Math.max(1, decimals)}})?$`).test(value) ||
    (decimals === 0 && value.includes('.'))
  )
    throw new Error(
      `${label} must be an exact decimal with at most ${decimals} fractional digits.`,
    );
  const parsed = parseUnits(value, decimals);
  if (parsed <= 0n || parsed >= (1n << 256n) - 1n)
    throw new Error(`${label} must be positive and finite.`);
  return parsed;
}
export async function planSoothCreation(
  node: SoothResolvedNode,
  account: Address,
  intent: SoothCreationIntent,
): Promise<SoothCreationPreview> {
  if (intent.question.trim().length < 10 || !intent.rules.trim())
    throw new Error('Enter a question of at least 10 characters and explicit resolution rules.');
  if (/(?:^|\n)§/.test(intent.question) || /(?:^|\n)§/.test(intent.rules))
    throw new Error('Section markers are not allowed inside question or rules.');
  const bBase = amount(intent.liquidity, 18, 'Liquidity depth');
  const initialProbabilityWad = amount(intent.probability, 16, 'Initial YES probability');
  if (bBase < 10n ** 17n || initialProbabilityWad >= 10n ** 18n)
    throw new Error('Liquidity depth must be at least 0.1 and probability must be below 100%.');
  const options = await readSoothCreationOptions(node, account);
  if (!options.walletMayCreate)
    throw new Error(
      options.paused
        ? 'Market creation is paused.'
        : 'This wallet is not allowed to create on this node.',
    );
  const token = options.tokens.find((t) => t.address.toLowerCase() === intent.token.toLowerCase());
  const profile = options.profiles.find(
    (p) => p.binding.address.toLowerCase() === intent.adjudicator.toLowerCase(),
  );
  if (!token || !profile)
    throw new Error('The selected collateral or resolution profile is not admitted and supported.');
  const kind = profile.binding.kind === 'imd-testnet' ? 'imd' : profile.binding.kind;
  if (kind !== intent.resolution.kind)
    throw new Error('Resolution fields do not match the selected profile.');
  if (!profile.resolvers.some((r) => r.toLowerCase() === intent.resolver.toLowerCase()))
    throw new Error('Select an approved resolver.');
  const maxInputNative = amount(intent.budget, token.decimals, 'Collateral budget');
  const question = generateSQF({
    question: intent.question.trim(),
    rule: { description: intent.rules.trim() },
  });
  if (question.length > 20_000) throw new Error('Market terms exceed the 20,000-character limit.');
  const terms = buildResolutionTerms(question, intent.resolver, intent.deadline, intent.resolution);
  const context = options.context;
  const { MarketFactoryAbi, AmmFeeVaultAbi, BookFeeVaultAbi } = getFactoryAbis(context.release);
  const client = factoryReadClient(node.client);
  const blockNumber = context.blockNumber;
  const read = <T>(
    address: Address,
    abi: readonly unknown[],
    functionName: string,
    args: readonly unknown[] = [],
  ) => client.readContract({ address, abi, functionName, args, blockNumber }) as Promise<T>;
  const c = context.contracts;
  const [block, pendingBlock, ammVersion, bookVersion, invalidationBuffer, balance, allowance] =
    await Promise.all([
      node.client.getBlock({ blockNumber }),
      node.client.getBlock({ blockTag: 'pending' }).catch(() => null),
      read<number>(c.ammVault, AmmFeeVaultAbi, 'activeConfigVersion'),
      read<number>(c.bookVault, BookFeeVaultAbi, 'activeConfigVersion'),
      read<bigint>(c.marketFactory, MarketFactoryAbi, 'invalidationBuffer'),
      read<bigint>(token.address, erc20Abi, 'balanceOf', [account]),
      read<bigint>(token.address, erc20Abi, 'allowance', [account, c.marketFactory]),
    ]);
  const now =
    pendingBlock && pendingBlock.timestamp > block.timestamp
      ? pendingBlock.timestamp
      : block.timestamp;
  if (intent.deadline <= now + 120n || intent.deadline >= (1n << 64n) - 1n)
    throw new Error('Deadline must leave at least two minutes to submit and trade.');
  if (!invalidationBuffer || !ammVersion || !bookVersion)
    throw new Error('The node has no active creation fee or invalidation configuration.');
  if (balance < maxInputNative)
    throw new Error('The collateral budget exceeds your wallet balance.');
  const [ammHash, bookHash, ammConfig, bookConfig] = await Promise.all([
    read<Hex>(c.ammVault, AmmFeeVaultAbi, 'configHash', [ammVersion]),
    read<Hex>(c.bookVault, BookFeeVaultAbi, 'configHash', [bookVersion]),
    read<FactoryAmmConfig>(c.ammVault, AmmFeeVaultAbi, 'configByVersion', [ammVersion]),
    read<FactoryBookConfig>(c.bookVault, BookFeeVaultAbi, 'configByVersion', [bookVersion]),
  ]);
  if (ammHash === zeroHash || bookHash === zeroHash)
    throw new Error('Fee configuration commitments are unavailable.');
  const params: FactoryCreationParams = {
    question: terms.question,
    startTime: 0n,
    deadline: intent.deadline,
    adjudicator: profile.binding.address,
    tokenA: token.address,
    bBase,
    initialProbabilityWad,
    adjudicatorConfig: terms.adjudicatorConfig,
    resolutionTermsHash: terms.resolutionTermsHash,
    maxInputNative,
    quoteDeadline: now + 120n,
    expectedAmmVersion: ammVersion,
    expectedBookVersion: bookVersion,
    expectedAmmHash: ammHash,
    expectedBookHash: bookHash,
    expectedProfileHash: profile.binding.profileHash,
    expectedInvalidationBuffer: invalidationBuffer,
  };
  if (allowance >= maxInputNative)
    await node.client.simulateContract({
      account,
      address: c.marketFactory,
      abi: MarketFactoryAbi,
      functionName: 'createMarket',
      args: [params],
    });
  return {
    node: formatSoothNodeReference(node.reference),
    account,
    intent: structuredClone(intent),
    context,
    params,
    profile,
    token,
    balance,
    allowance,
    approveNative: allowance >= maxInputNative ? null : allowance > 0n ? 0n : maxInputNative,
    ammConfig,
    bookConfig,
  };
}
export interface SoothSubmittedCreation extends SoothPendingCreation {
  storageAvailable: boolean;
}
const submitting = new Set<string>();
async function assertSession(
  wallet: SoothWalletAdapter,
  account: Address,
  chainId: number,
): Promise<void> {
  const session = await wallet.getSession();
  if (
    !session ||
    session.account.toLowerCase() !== account.toLowerCase() ||
    session.chainId !== chainId
  )
    throw new Error('Wallet account or chain changed. Connect to this node and review again.');
}
/** One click signs one action: an approval never automatically sends creation. */
export async function sendSoothCreation(
  node: SoothResolvedNode,
  wallet: SoothWalletAdapter,
  preview: SoothCreationPreview,
  kind: 'approveCreation' | 'createMarket',
  onPending: (pending: SoothSubmittedCreation) => void,
): Promise<SoothSubmittedCreation> {
  const reference = formatSoothNodeReference(node.reference);
  if (reference !== preview.node) throw new Error('The reviewed node changed.');
  const key = `${reference}:${preview.account.toLowerCase()}`;
  if (submitting.has(key))
    throw new Error('A creation action is already being submitted for this node and account.');
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  if (!locks?.request)
    throw new Error('This browser needs Web Locks support to coordinate wallet submissions.');
  submitting.add(key);
  return new Promise((resolve, reject) => {
    void locks
      .request(`sooth:create:${key}`, { mode: 'exclusive', ifAvailable: true }, async (lock) => {
        if (!lock) throw new Error('Another window is submitting a creation action.');
        const guard = () => {
          if (!canPersistSoothPending())
            throw new Error('Enable shared browser storage before signing.');
          if (
            loadSoothPendingCreations(reference).some(
              (p) => p.account.toLowerCase() === preview.account.toLowerCase(),
            )
          )
            throw new Error('Reconcile the pending creation action before signing another.');
        };
        guard();
        await assertSession(wallet, preview.account, node.reference.chainId);
        const fresh = await planSoothCreation(node, preview.account, preview.intent);
        const before = preview.params,
          after = fresh.params;
        if (
          before.expectedProfileHash !== after.expectedProfileHash ||
          before.expectedAmmHash !== after.expectedAmmHash ||
          before.expectedBookHash !== after.expectedBookHash ||
          before.expectedInvalidationBuffer !== after.expectedInvalidationBuffer ||
          before.expectedAmmVersion !== after.expectedAmmVersion ||
          before.expectedBookVersion !== after.expectedBookVersion ||
          before.maxInputNative !== after.maxInputNative ||
          before.resolutionTermsHash !== after.resolutionTermsHash ||
          before.adjudicatorConfig !== after.adjudicatorConfig ||
          before.question !== after.question ||
          before.deadline !== after.deadline ||
          before.startTime !== after.startTime ||
          before.bBase !== after.bBase ||
          before.initialProbabilityWad !== after.initialProbabilityWad ||
          before.adjudicator !== after.adjudicator ||
          before.tokenA !== after.tokenA ||
          preview.token.address !== fresh.token.address
        )
          throw new Error('Creation terms changed. Review the fresh configuration.');
        if (kind === 'createMarket' && fresh.approveNative !== null)
          throw new Error('The collateral allowance changed. Review and approve again.');
        if (
          kind === 'approveCreation' &&
          (fresh.approveNative === null || fresh.approveNative !== preview.approveNative)
        )
          throw new Error('The required approval changed. Review again.');
        const action =
          kind === 'createMarket'
            ? ({ kind, params: preview.params } as const)
            : ({
                kind,
                tokenA: preview.token.address,
                amountNative: fresh.approveNative!,
              } as const);
        const request = await buildFactoryTransaction({
          context: fresh.context,
          endpoints: node.endpoints,
          account: preview.account,
          adjudicatorBinding: fresh.profile.binding,
          action,
        });
        await assertSession(wallet, preview.account, request.chainId);
        await node.client.simulateContract({
          account: request.account,
          address: request.address,
          abi: request.abi,
          functionName: request.functionName,
          args: request.args,
          value: request.value,
        });
        await assertSession(wallet, preview.account, request.chainId);
        guard();
        const hash = await wallet.sendTransaction({
          account: request.account,
          chainId: request.chainId,
          to: request.to,
          data: request.data,
          value: request.value,
        });
        const record: SoothPendingCreation = {
          version: 1,
          node: reference,
          account: request.account,
          chainId: request.chainId,
          to: request.to,
          data: request.data,
          hash,
          kind,
          submittedAt: Date.now(),
        };
        const result = { ...record, storageAvailable: saveSoothPendingCreation(record) };
        try {
          onPending(result);
        } catch {
          /* Notification cannot undo the recorded broadcast. */
        }
        if (!result.storageAvailable) {
          resolve(result);
          for (;;) {
            await new Promise<void>((resume) => setTimeout(resume, 4_000));
            if (saveSoothPendingCreation(record)) break;
            try {
              if ((await reconcileSoothCreation(node, record)).status !== 'pending') break;
            } catch {
              /* Keep the cross-window lock until receipt evidence or storage returns. */
            }
          }
        }
        return result;
      })
      .then(
        (result) => {
          submitting.delete(key);
          resolve(result);
        },
        (error) => {
          submitting.delete(key);
          reject(error);
        },
      );
  });
}
