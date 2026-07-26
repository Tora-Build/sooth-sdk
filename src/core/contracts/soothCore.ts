import { encodePacked, erc20Abi, keccak256, type Address, type PublicClient } from 'viem';
import { AMMEngineABI } from '../abis/AMMEngine.js';
import { CollateralizerABI } from '../abis/Collateralizer.js';
import { LaunchpadEngineABI } from '../abis/LaunchpadEngine.js';
import { OrderEngineABI } from '../abis/OrderEngine.js';
import { SoothBookABI } from '../abis/SoothBook.js';
import { TruthMarketABI } from '../abis/TruthMarket.js';
import {
  OUTCOME,
  readLaunchpadAmmQuoteFromSnapshot,
  readLaunchpadAmmSnapshot,
  type BinaryOutcome,
  type LaunchpadAmmContracts,
  type LaunchpadAmmMarketSnapshot,
  type LaunchpadAmmQuote,
  type LaunchpadAmmSnapshotOptions,
  type ReadLaunchpadAmmQuoteFromSnapshotOptions,
  type SoothTradeAction,
} from './launchpadAmm.js';

export type SoothTradingVenue = 'amm' | 'soothbook';

const WAD = 10n ** 18n;
const BPS_DENOMINATOR = 10_000n;
const MAX_UINT256 = (1n << 256n) - 1n;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

export interface SoothCoreContracts extends LaunchpadAmmContracts {
  soothBook?: Address;
  orderEngine?: Address;
}

export interface SoothCoreSnapshotOptions extends LaunchpadAmmSnapshotOptions {
  includeQuestion?: boolean;
}

export interface SoothTruthMarketSnapshot {
  creator: Address;
  deadline: bigint;
  winningOutcome: number;
  isSettled: boolean;
  isFinalized: boolean;
  isLive: boolean;
  question?: string;
}

export interface SoothCollateralizerSnapshot {
  isRegistered: boolean;
  isSettled: boolean;
  totalCollateral: bigint;
  yesToken: Address;
  noToken: Address;
  userYesBalance: bigint;
  userNoBalance: bigint;
}

export interface SoothBookMarketSnapshot {
  marketKey: `0x${string}`;
  exists: boolean;
  collateral: Address;
  yesToken: Address;
  noToken: Address;
  isActive: boolean;
  isFinalized: boolean;
  outcome: number;
  backing: bigint;
  yesPriceWad: bigint;
  noPriceWad: bigint;
  yesProbability: number;
  noProbability: number;
  bestYesTick: number;
  bestNoTick: number;
  feeBps: bigint;
  userYesBalance: bigint;
  userNoBalance: bigint;
}

export interface SoothCoreSnapshot {
  marketAddress: Address;
  marketKey: `0x${string}`;
  launchpadAmm: LaunchpadAmmMarketSnapshot;
  truth: SoothTruthMarketSnapshot;
  collateralizer: SoothCollateralizerSnapshot | null;
  soothBook: SoothBookMarketSnapshot | null;
  tradingVenue: SoothTradingVenue;
}

export interface BuildLaunchpadTradeRequestInput {
  marketAddress: Address;
  action: SoothTradeAction;
  outcome: BinaryOutcome;
  shares: bigint;
  maxCostOrMinProceeds: bigint;
}

export interface BuildSoothBookBuyRequestInput {
  marketAddress: Address;
  outcome: BinaryOutcome;
  tick: number;
  amount: bigint;
  escrow?: boolean;
  /**
   * Slippage guard — accepted for back-compat but no longer encoded into
   * the calldata. The deployed v0.2.0 SoothBook ABI's 5th arg is
   * `uint32 matchLimit`, not maxCost. Callers wanting cost protection
   * should rely on the per-fill tick clamp (the order won't pay above
   * its tick) plus `matchLimit`.
   */
  maxCost?: bigint;
  /**
   * Maximum number of resting orders to consume per call. Defaults to
   * 100, matching the apps/market hook. Must fit in uint32.
   */
  matchLimit?: number;
}

export interface BuildSoothBookSellRequestInput {
  marketAddress: Address;
  outcome: BinaryOutcome;
  /**
   * SAME-SIDE desired price in thousandths (1..999) — the price the
   * caller wants to receive for `outcome` shares. The SDK inverts to
   * place an opposite-side escrow buy at `1000 − tick`, since SoothBook
   * crossing is `YES_tick + NO_tick ≥ 1000`. Pre-RR1 the tick was
   * passed through unchanged, posting on the wrong price level.
   */
  tick: number;
  amount: bigint;
  /** Back-compat slippage hint; not encoded — see BuildSoothBookBuyRequestInput.maxCost. */
  maxCost?: bigint;
  /** Default 100; uint32 cap on per-call matches. */
  matchLimit?: number;
}

export interface BuildSoothBookCancelRequestInput {
  marketAddress: Address;
  side: BinaryOutcome;
  tick: number;
}

export interface BuildSoothBookCancelByIdRequestInput {
  orderId: bigint;
}

export interface BuildSoothBookMintRequestInput {
  marketAddress: Address;
  amount: bigint;
}

export interface BuildSoothBookMergeRequestInput {
  marketAddress: Address;
  amount: bigint;
}

export interface BuildSoothBookRedeemRequestInput {
  marketAddress: Address;
}

export interface ComputeSoothBookMaxCostInput {
  tick: number;
  amount: bigint;
  slippageBps?: bigint | number;
}

export interface ReadSoothBookQuoteOptions {
  action: SoothTradeAction;
  outcome: BinaryOutcome;
  shares: bigint;
  snapshot?: SoothBookMarketSnapshot | null;
}

export interface SoothBookQuote {
  action: SoothTradeAction;
  outcome: BinaryOutcome;
  shares: bigint;
  priceWad: bigint;
  rawQuote: bigint;
  feeBps: bigint;
  fee: bigint;
  total: bigint;
  proceeds: bigint;
  isIndicative: true;
}

export interface ReadSoothQuoteOptions {
  action: SoothTradeAction;
  outcome: BinaryOutcome;
  shares: bigint;
  snapshot?: SoothCoreSnapshot;
}

export interface SoothQuote {
  action: SoothTradeAction;
  outcome: BinaryOutcome;
  shares: bigint;
  venue: SoothTradingVenue;
  isIndicative: boolean;
  rawQuote: bigint;
  fee: bigint;
  total: bigint;
  proceeds: bigint;
  newPriceYes?: number;
  ammQuote?: LaunchpadAmmQuote;
  soothBookQuote?: SoothBookQuote;
}

export type ClaimRoute =
  | 'dismissed_refund'
  | 'order_settle' // OrderEngine unified custody (SoothBook + graduated/collateral positions)
  | 'amm_settle'; // AMMEngine LMSR positions

export type ClaimTxRequest =
  | {
      route: 'dismissed_refund';
      contract: Address;
      functionName: 'claimRefund';
      args: readonly [Address];
    }
  | {
      route: 'order_settle';
      contract: Address;
      functionName: 'settlePosition';
      args: readonly [Address];
    }
  | {
      route: 'amm_settle';
      contract: Address;
      functionName: 'settlePosition';
      args: readonly [Address];
    };

export interface ClaimRequestPlan {
  route: ClaimRoute;
  requests: readonly ClaimTxRequest[];
}

export interface TradePreflightInput {
  action: SoothTradeAction;
  outcome: number;
  shares: bigint;
  userBalance?: bigint;
  maxCostOrMinProceeds?: bigint;
  quotedTotal?: bigint;
}

export type TradePreflightFailureReason =
  | 'invalid_outcome'
  | 'invalid_shares'
  | 'market_not_active'
  | 'market_settled'
  | 'market_dismissed'
  | 'venue_unavailable'
  | 'insufficient_balance'
  | 'invalid_guard';

export type TradePreflightResult =
  | { canTrade: true }
  | {
      canTrade: false;
      reason: TradePreflightFailureReason;
      required?: bigint;
      available?: bigint;
    };

export interface BuildApprovalRequestInput {
  tokenAddress: Address;
  spender: Address;
  amount: bigint;
  allowance: bigint;
  approveAmount?: bigint;
}

export interface ReadApprovalRequestInput {
  tokenAddress: Address;
  owner: Address;
  spender: Address;
  amount: bigint;
  approveAmount?: bigint;
}

export interface ApprovalRequest {
  contract: Address;
  functionName: 'approve';
  args: readonly [Address, bigint];
  requiredAmount: bigint;
  currentAllowance: bigint;
}

export interface SoothCoreDataProvider {
  getSnapshot: (
    marketAddress: Address,
    options?: SoothCoreSnapshotOptions,
  ) => Promise<SoothCoreSnapshot>;
  getSnapshots?: (
    marketAddresses: readonly Address[],
    options?: SoothCoreSnapshotOptions,
  ) => Promise<SoothCoreSnapshot[]>;
  getQuote?: (marketAddress: Address, options: ReadSoothQuoteOptions) => Promise<SoothQuote>;
  listMarkets?: () => Promise<Address[]>;
}

export type SoothCoreClientMode = 'rpc' | 'indexed';

export interface SoothCoreClient {
  mode: SoothCoreClientMode;
  getSnapshot: (
    marketAddress: Address,
    options?: SoothCoreSnapshotOptions,
  ) => Promise<SoothCoreSnapshot>;
  getSnapshots: (
    marketAddresses: readonly Address[],
    options?: SoothCoreSnapshotOptions,
  ) => Promise<SoothCoreSnapshot[]>;
  getQuote: (marketAddress: Address, options: ReadSoothQuoteOptions) => Promise<SoothQuote>;
  getAmmQuote: (
    snapshot: LaunchpadAmmMarketSnapshot,
    options: ReadLaunchpadAmmQuoteFromSnapshotOptions,
  ) => Promise<LaunchpadAmmQuote>;
  getSoothBookQuote: (
    marketAddress: Address,
    options: ReadSoothBookQuoteOptions,
  ) => Promise<SoothBookQuote>;
  computeSoothBookMaxCost: (input: ComputeSoothBookMaxCostInput) => bigint;
  buildTrade: (input: BuildTradeRequestInput) => SoothTradeRequest;
  buildSoothBookBuy: (
    input: BuildSoothBookBuyRequestInput,
  ) => ReturnType<typeof buildSoothBookBuyRequest>;
  buildSoothBookSell: (
    input: BuildSoothBookSellRequestInput,
  ) => ReturnType<typeof buildSoothBookSellRequest>;
  buildSoothBookCancel: (
    input: BuildSoothBookCancelRequestInput,
  ) => ReturnType<typeof buildSoothBookCancelRequest>;
  buildSoothBookCancelById: (
    input: BuildSoothBookCancelByIdRequestInput,
  ) => ReturnType<typeof buildSoothBookCancelByIdRequest>;
  buildSoothBookMint: (
    input: BuildSoothBookMintRequestInput,
  ) => ReturnType<typeof buildSoothBookMintRequest>;
  buildSoothBookMerge: (
    input: BuildSoothBookMergeRequestInput,
  ) => ReturnType<typeof buildSoothBookMergeRequest>;
  buildSoothBookRedeem: (
    input: BuildSoothBookRedeemRequestInput,
  ) => ReturnType<typeof buildSoothBookRedeemRequest>;
  buildClaim: (snapshot: SoothCoreSnapshot) => ClaimRequestPlan | null;
  preflightTrade: (snapshot: SoothCoreSnapshot, input: TradePreflightInput) => TradePreflightResult;
  readApprovalRequest: (input: ReadApprovalRequestInput) => Promise<ApprovalRequest | null>;
  buildApprovalRequest: (input: BuildApprovalRequestInput) => ApprovalRequest | null;
  listMarkets: () => Promise<Address[]>;
}

export interface BuildTradeRequestInput {
  marketAddress: Address;
  action: SoothTradeAction;
  outcome: BinaryOutcome;
  shares: bigint;
  maxCostOrMinProceeds: bigint;
  venue?: SoothTradingVenue;
  snapshot?: SoothCoreSnapshot;
  tick?: number;
  escrow?: boolean;
}

export type SoothTradeRequest =
  | ({
      venue: 'amm';
    } & ReturnType<typeof buildLaunchpadTradeRequest>)
  | ({
      venue: 'soothbook';
    } & (
      | ReturnType<typeof buildSoothBookBuyRequest>
      | ReturnType<typeof buildSoothBookSellRequest>
    ));

export type SoothBookWriteRequest =
  | ReturnType<typeof buildSoothBookBuyRequest>
  | ReturnType<typeof buildSoothBookSellRequest>
  | ReturnType<typeof buildSoothBookCancelRequest>
  | ReturnType<typeof buildSoothBookCancelByIdRequest>
  | ReturnType<typeof buildSoothBookMintRequest>
  | ReturnType<typeof buildSoothBookMergeRequest>
  | ReturnType<typeof buildSoothBookRedeemRequest>;

export type CreateSoothCoreClientConfig =
  | {
      mode?: 'rpc';
      publicClient: PublicClient;
      contracts: SoothCoreContracts;
      indexedProvider?: SoothCoreDataProvider;
    }
  | {
      mode: 'indexed';
      indexedProvider: SoothCoreDataProvider;
      publicClient?: PublicClient;
      contracts?: SoothCoreContracts;
    };

// Deployed v0.1.2 SoothBook.markets(bytes32) returns only the 3 state flags;
// collateral/YES/NO token addresses live on the deployment manifest and on
// the market contract itself, NOT in this tuple.
type _SoothBookMarketTuple = readonly [boolean, boolean, number];

function clampProbability(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

async function readWithFallback<T>(read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await read();
  } catch {
    return fallback;
  }
}

function toBigInt(value: bigint | number): bigint {
  return typeof value === 'bigint' ? value : BigInt(value);
}

function assertAddress(name: string, value?: Address): Address {
  if (!value || value === ZERO_ADDRESS) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

function normalizeSoothBookPrice(outcome: BinaryOutcome, market: SoothBookMarketSnapshot): bigint {
  return outcome === OUTCOME.YES ? market.yesPriceWad : market.noPriceWad;
}

function normalizeTick(tick: number): number {
  if (!Number.isFinite(tick)) {
    throw new Error('tick must be a finite number');
  }
  const rounded = Math.round(tick);
  if (rounded < 1 || rounded > 999) {
    throw new Error('tick must be in range [1, 999]');
  }
  return rounded;
}

export function computeSoothMarketKey(marketAddress: Address): `0x${string}` {
  return keccak256(encodePacked(['address'], [marketAddress]));
}

export function selectTradingVenue(snapshot: {
  launchpadAmm: { launchpad: { isGraduated: boolean } };
  truth: { isSettled: boolean; isFinalized: boolean };
  soothBook: { isActive: boolean; isFinalized: boolean } | null;
}): SoothTradingVenue {
  if (snapshot.truth.isSettled || snapshot.truth.isFinalized) {
    return 'amm';
  }

  const hasActiveSoothBook =
    !!snapshot.soothBook && snapshot.soothBook.isActive && !snapshot.soothBook.isFinalized;
  if (snapshot.launchpadAmm.launchpad.isGraduated && hasActiveSoothBook) {
    return 'soothbook';
  }

  return 'amm';
}

export function computeSoothBookQuote(
  snapshot: SoothBookMarketSnapshot,
  options: ReadSoothBookQuoteOptions,
): SoothBookQuote {
  if (options.shares <= 0n) {
    throw new Error('shares must be greater than zero');
  }

  if (options.outcome !== OUTCOME.NO && options.outcome !== OUTCOME.YES) {
    throw new Error('SoothBook quote only supports binary outcomes');
  }

  const priceWad = normalizeSoothBookPrice(options.outcome, snapshot);
  const rawQuote = (options.shares * priceWad) / WAD;
  const fee = (rawQuote * snapshot.feeBps) / BPS_DENOMINATOR;
  const proceeds = rawQuote > fee ? rawQuote - fee : 0n;
  const total = options.action === 'buy' ? rawQuote + fee : proceeds;

  return {
    action: options.action,
    outcome: options.outcome,
    shares: options.shares,
    priceWad,
    rawQuote,
    feeBps: snapshot.feeBps,
    fee,
    total,
    proceeds,
    isIndicative: true,
  };
}

export async function readTruthMarketSnapshot(
  client: PublicClient,
  marketAddress: Address,
  options: { includeQuestion?: boolean } = {},
): Promise<SoothTruthMarketSnapshot> {
  const [creator, deadline, winningOutcome, isSettled, isLive, questionHash] = await Promise.all([
    readWithFallback(
      () =>
        client.readContract({
          address: marketAddress,
          abi: TruthMarketABI,
          functionName: 'creator',
        }) as Promise<Address>,
      ZERO_ADDRESS,
    ),
    readWithFallback(
      () =>
        client.readContract({
          address: marketAddress,
          abi: TruthMarketABI,
          functionName: 'deadline',
        }) as Promise<bigint>,
      0n,
    ),
    readWithFallback(
      () =>
        client.readContract({
          address: marketAddress,
          abi: TruthMarketABI,
          functionName: 'winningOutcome',
        }) as Promise<number>,
      Number(OUTCOME.INVALID),
    ),
    readWithFallback(
      () =>
        client.readContract({
          address: marketAddress,
          abi: TruthMarketABI,
          functionName: 'isSettled',
        }) as Promise<boolean>,
      false,
    ),
    readWithFallback(
      () =>
        client.readContract({
          address: marketAddress,
          abi: TruthMarketABI,
          functionName: 'isLive',
        }) as Promise<boolean>,
      true,
    ),
    options.includeQuestion
      ? readWithFallback(
          () =>
            client.readContract({
              address: marketAddress,
              abi: TruthMarketABI,
              functionName: 'questionHash',
            }) as Promise<string>,
          '',
        )
      : Promise.resolve(undefined),
  ]);

  return {
    creator,
    deadline,
    winningOutcome: Number(winningOutcome),
    isSettled,
    isFinalized: isSettled,
    isLive,
    question: questionHash ? String(questionHash).slice(0, 18) + '...' : undefined,
  };
}

export async function readCollateralizerSnapshot(
  client: PublicClient,
  collateralizer: Address,
  marketAddress: Address,
  _userAddress?: Address,
): Promise<SoothCollateralizerSnapshot> {
  // v0.1.2 replaced Collateralizer with OrderEngine. OrderEngine exposes
  // isMarketRegistered, but not isMarketSettled / getTotalCollateral /
  // getOutcomeTokens / getBalances — firing those wastes an RPC roundtrip
  // per market. Keep the single registration probe; callers that need
  // settlement, collateral, tokens, or balances should read from OrderEngine
  // / TruthMarket directly.
  const isRegistered = await readWithFallback(
    () =>
      client.readContract({
        address: collateralizer,
        abi: CollateralizerABI,
        functionName: 'isMarketRegistered',
        args: [marketAddress],
      }) as Promise<boolean>,
    false,
  );

  return {
    isRegistered,
    isSettled: false,
    totalCollateral: 0n,
    yesToken: ZERO_ADDRESS,
    noToken: ZERO_ADDRESS,
    userYesBalance: 0n,
    userNoBalance: 0n,
  };
}

export async function readSoothBookMarketSnapshot(
  client: PublicClient,
  soothBook: Address,
  marketAddress: Address,
  userAddress?: Address,
): Promise<SoothBookMarketSnapshot | null> {
  const marketKey = computeSoothMarketKey(marketAddress);

  // v0.2.1: SoothBook.markets(bytes32)→(active,finalized,outcome) was deleted.
  // Replacement: registeredMarkets(bytes32)→bool; finalized/outcome moved to
  // TruthMarket. Callers that need finalized/outcome should read TruthMarket
  // directly (TruthMarket.isSettled() + TruthMarket.outcome()).
  // Likewise getImpliedPrice(bytes32) was renamed to getImpliedPriceByKey;
  // the bare getImpliedPrice now takes an `address market` instead.
  const [isRegistered, impliedPrice, bestYesTickRaw, bestNoTickRaw, backing, feeBps, userBalances] =
    await Promise.all([
      readWithFallback(
        () =>
          client.readContract({
            address: soothBook,
            abi: SoothBookABI,
            functionName: 'registeredMarkets',
            args: [marketKey],
          }) as Promise<boolean>,
        false,
      ),
      readWithFallback(
        () =>
          client.readContract({
            address: soothBook,
            abi: SoothBookABI,
            functionName: 'getImpliedPriceByKey',
            args: [marketKey],
          }) as Promise<readonly [bigint, bigint]>,
        [WAD / 2n, WAD / 2n] as const,
      ),
      readWithFallback(
        () =>
          client.readContract({
            address: soothBook,
            abi: SoothBookABI,
            functionName: 'getBestTick',
            args: [marketKey, 1],
          }) as Promise<number | bigint>,
        0,
      ),
      readWithFallback(
        () =>
          client.readContract({
            address: soothBook,
            abi: SoothBookABI,
            functionName: 'getBestTick',
            args: [marketKey, 0],
          }) as Promise<number | bigint>,
        0,
      ),
      readWithFallback(
        () =>
          client.readContract({
            address: soothBook,
            abi: SoothBookABI,
            functionName: 'getCollateralBacking',
            args: [marketKey],
          }) as Promise<bigint>,
        0n,
      ),
      readWithFallback(
        () =>
          client.readContract({
            address: soothBook,
            abi: SoothBookABI,
            functionName: 'feeBps',
          }) as Promise<number | bigint>,
        0,
      ),
      userAddress
        ? readWithFallback(
            () =>
              client.readContract({
                address: soothBook,
                abi: SoothBookABI,
                functionName: 'getBalance',
                args: [marketKey, userAddress],
              }) as Promise<readonly [bigint, bigint]>,
            [0n, 0n] as const,
          )
        : Promise.resolve([0n, 0n] as const),
    ]);

  const isActive = isRegistered;
  // v0.2.1 SoothBook no longer exposes finalized/outcome — they live on
  // TruthMarket now. Snapshot shape is preserved for callers; if they need
  // settlement state they must read TruthMarket directly.
  const isFinalized = false;
  const outcome: number = Number(OUTCOME.INVALID);
  const exists = isActive || backing > 0n;
  if (!exists) {
    return null;
  }
  const collateral = ZERO_ADDRESS;
  const yesToken = ZERO_ADDRESS;
  const noToken = ZERO_ADDRESS;

  const yesPriceWad = impliedPrice[0];
  const noPriceWad = impliedPrice[1];
  const yesProbability = clampProbability(Number(yesPriceWad) / 1e18);
  const noProbability = clampProbability(1 - yesProbability);

  return {
    marketKey,
    exists,
    collateral,
    yesToken,
    noToken,
    isActive,
    isFinalized,
    outcome: Number(outcome),
    backing,
    yesPriceWad,
    noPriceWad,
    yesProbability,
    noProbability,
    bestYesTick: Number(bestYesTickRaw),
    bestNoTick: Number(bestNoTickRaw),
    feeBps: toBigInt(feeBps),
    userYesBalance: userBalances[0],
    userNoBalance: userBalances[1],
  };
}

export async function readSoothBookQuote(
  client: PublicClient,
  contracts: SoothCoreContracts,
  marketAddress: Address,
  options: ReadSoothBookQuoteOptions,
): Promise<SoothBookQuote> {
  const marketSnapshot =
    options.snapshot ??
    (await readSoothBookMarketSnapshot(
      client,
      assertAddress('soothBook', contracts.soothBook),
      marketAddress,
    ));

  if (!marketSnapshot) {
    throw new Error('SoothBook market is unavailable for this market');
  }

  return computeSoothBookQuote(marketSnapshot, options);
}

export async function readSoothCoreSnapshot(
  client: PublicClient,
  contracts: SoothCoreContracts,
  marketAddress: Address,
  options: SoothCoreSnapshotOptions = {},
): Promise<SoothCoreSnapshot> {
  const marketKey = computeSoothMarketKey(marketAddress);

  const [truth, launchpadAmm, collateralizer, soothBook] = await Promise.all([
    readTruthMarketSnapshot(client, marketAddress, {
      includeQuestion: options.includeQuestion,
    }),
    readLaunchpadAmmSnapshot(client, contracts, marketAddress, options),
    contracts.orderEngine
      ? readCollateralizerSnapshot(
          client,
          contracts.orderEngine,
          marketAddress,
          options.userAddress,
        )
      : Promise.resolve(null),
    contracts.soothBook
      ? readSoothBookMarketSnapshot(client, contracts.soothBook, marketAddress, options.userAddress)
      : Promise.resolve(null),
  ]);

  const tradingVenue = selectTradingVenue({
    launchpadAmm,
    truth,
    soothBook,
  });

  return {
    marketAddress,
    marketKey,
    launchpadAmm,
    truth,
    collateralizer,
    soothBook,
    tradingVenue,
  };
}

export async function readSoothCoreSnapshots(
  client: PublicClient,
  contracts: SoothCoreContracts,
  marketAddresses: readonly Address[],
  options: SoothCoreSnapshotOptions = {},
): Promise<SoothCoreSnapshot[]> {
  return Promise.all(
    marketAddresses.map((marketAddress) =>
      readSoothCoreSnapshot(client, contracts, marketAddress, options),
    ),
  );
}

export async function readSoothQuote(
  client: PublicClient,
  contracts: SoothCoreContracts,
  marketAddress: Address,
  options: ReadSoothQuoteOptions,
): Promise<SoothQuote> {
  const snapshot =
    options.snapshot ?? (await readSoothCoreSnapshot(client, contracts, marketAddress));

  if (snapshot.tradingVenue === 'soothbook' && snapshot.soothBook) {
    const soothBookQuote = await readSoothBookQuote(client, contracts, marketAddress, {
      action: options.action,
      outcome: options.outcome,
      shares: options.shares,
      snapshot: snapshot.soothBook,
    });

    return {
      action: options.action,
      outcome: options.outcome,
      shares: options.shares,
      venue: 'soothbook',
      isIndicative: true,
      rawQuote: soothBookQuote.rawQuote,
      fee: soothBookQuote.fee,
      total: soothBookQuote.total,
      proceeds: soothBookQuote.proceeds,
      newPriceYes: snapshot.soothBook.yesProbability,
      soothBookQuote,
    };
  }

  const ammQuote = await readLaunchpadAmmQuoteFromSnapshot(
    client,
    contracts,
    snapshot.launchpadAmm,
    {
      action: options.action,
      outcome: options.outcome,
      shares: options.shares,
    },
  );

  return {
    action: options.action,
    outcome: options.outcome,
    shares: options.shares,
    venue: 'amm',
    isIndicative: false,
    rawQuote: ammQuote.rawQuote,
    fee: ammQuote.fee,
    total: ammQuote.total,
    proceeds: ammQuote.proceeds,
    newPriceYes: ammQuote.newPriceYes,
    ammQuote,
  };
}

export function buildLaunchpadTradeRequest(input: BuildLaunchpadTradeRequestInput): {
  functionName: 'tradePositions';
  args: readonly [Address, BinaryOutcome, bigint, bigint];
} {
  const deltaShares = input.action === 'buy' ? input.shares : -input.shares;
  return {
    functionName: 'tradePositions',
    args: [input.marketAddress, input.outcome, deltaShares, input.maxCostOrMinProceeds] as const,
  };
}

export function buildSoothBookBuyRequest(input: BuildSoothBookBuyRequestInput): {
  marketKey: `0x${string}`;
  functionName: 'buyYes' | 'buyNo';
  args: readonly [`0x${string}`, number, bigint, boolean, bigint];
} {
  if (input.outcome !== OUTCOME.NO && input.outcome !== OUTCOME.YES) {
    throw new Error('SoothBook only supports binary outcomes for buy requests');
  }

  const marketKey = computeSoothMarketKey(input.marketAddress);
  const tick = normalizeTick(input.tick);
  // 5th arg is uint32 matchLimit on v0.2.0 SoothBook (NOT maxCost). The
  // earlier shape passed input.maxCost here, which encoded a 1e16-scale
  // bigint into a uint32 slot and reverted at viem's range check.
  const matchLimit = BigInt(input.matchLimit ?? 100);
  return {
    marketKey,
    functionName: input.outcome === OUTCOME.YES ? 'buyYes' : 'buyNo',
    args: [marketKey, tick, input.amount, input.escrow ?? false, matchLimit] as const,
  };
}

export function computeSoothBookMaxCost(input: ComputeSoothBookMaxCostInput): bigint {
  if (input.amount <= 0n) {
    throw new Error('amount must be greater than zero');
  }

  const tick = BigInt(normalizeTick(input.tick));
  const slippage =
    input.slippageBps === undefined
      ? 500n
      : typeof input.slippageBps === 'bigint'
        ? input.slippageBps
        : BigInt(input.slippageBps);

  if (slippage < 0n || slippage > BPS_DENOMINATOR) {
    throw new Error('slippageBps must be in range [0, 10000]');
  }

  // SoothBook costs are in collateral token units: amount * tick / 1000.
  const rawCost = (input.amount * tick) / 1000n;
  return rawCost + (rawCost * slippage) / BPS_DENOMINATOR;
}

export function buildSoothBookSellRequest(input: BuildSoothBookSellRequestInput): {
  marketKey: `0x${string}`;
  functionName: 'buyYes' | 'buyNo';
  args: readonly [`0x${string}`, number, bigint, true, bigint];
} {
  if (input.outcome !== OUTCOME.NO && input.outcome !== OUTCOME.YES) {
    throw new Error('SoothBook only supports binary outcomes for sell requests');
  }

  // SoothBook crossing rule (.claude/rules/lessons.md):
  //   YES tick T  = buyer pays T/1000 for YES
  //   NO  tick T  = buyer pays T/1000 for NO  = seller accepts (1000-T)/1000 for YES
  //   Crossing:  YES_tick + NO_tick >= 1000
  // So "sell YES at tick T" must rest on the NO side at tick (1000 - T)
  // (and symmetrically sell NO at tick T → YES side at 1000 - T). Codex
  // re-review #RR1: previously the tick was passed through unchanged,
  // putting the sell on the wrong side of the book — inverted price,
  // immediate self-cross or wrong fill.
  const marketKey = computeSoothMarketKey(input.marketAddress);
  const requestedTick = normalizeTick(input.tick);
  const oppositeTick = normalizeTick(1000 - requestedTick);
  const oppositeFunction = input.outcome === OUTCOME.YES ? 'buyNo' : 'buyYes';

  // Sell path in SoothBook is modeled as escrow buy on opposite side.
  // 5th arg is uint32 matchLimit (not maxCost) — same fix as the buy path.
  const matchLimit = BigInt(input.matchLimit ?? 100);
  return {
    marketKey,
    functionName: oppositeFunction,
    args: [marketKey, oppositeTick, input.amount, true, matchLimit] as const,
  };
}

export function buildSoothBookCancelRequest(input: BuildSoothBookCancelRequestInput): {
  marketKey: `0x${string}`;
  functionName: 'cancel';
  args: readonly [`0x${string}`, BinaryOutcome, number];
} {
  const marketKey = computeSoothMarketKey(input.marketAddress);
  return {
    marketKey,
    functionName: 'cancel',
    args: [marketKey, input.side, normalizeTick(input.tick)] as const,
  };
}

export function buildSoothBookCancelByIdRequest(input: BuildSoothBookCancelByIdRequestInput): {
  functionName: 'cancelById';
  args: readonly [bigint];
} {
  return {
    functionName: 'cancelById',
    args: [input.orderId] as const,
  };
}

export function buildSoothBookMintRequest(input: BuildSoothBookMintRequestInput): {
  marketKey: `0x${string}`;
  functionName: 'mint';
  args: readonly [`0x${string}`, bigint];
} {
  const marketKey = computeSoothMarketKey(input.marketAddress);
  return {
    marketKey,
    functionName: 'mint',
    args: [marketKey, input.amount] as const,
  };
}

export function buildSoothBookMergeRequest(input: BuildSoothBookMergeRequestInput): {
  marketKey: `0x${string}`;
  functionName: 'merge';
  args: readonly [`0x${string}`, bigint];
} {
  const marketKey = computeSoothMarketKey(input.marketAddress);
  return {
    marketKey,
    functionName: 'merge',
    args: [marketKey, input.amount] as const,
  };
}

export function buildSoothBookRedeemRequest(input: BuildSoothBookRedeemRequestInput): {
  marketKey: `0x${string}`;
  functionName: 'redeem';
  args: readonly [`0x${string}`];
} {
  const marketKey = computeSoothMarketKey(input.marketAddress);
  return {
    marketKey,
    functionName: 'redeem',
    args: [marketKey] as const,
  };
}

export function buildTradeRequest(input: BuildTradeRequestInput): SoothTradeRequest {
  const venue = input.venue ?? input.snapshot?.tradingVenue ?? 'amm';

  if (venue === 'soothbook') {
    const tick =
      input.tick ??
      (input.snapshot?.soothBook
        ? input.outcome === OUTCOME.YES
          ? input.snapshot.soothBook.bestYesTick
          : input.snapshot.soothBook.bestNoTick
        : undefined);

    if (tick === undefined) {
      throw new Error('tick is required for SoothBook requests');
    }

    if (input.action === 'sell') {
      return {
        venue: 'soothbook',
        ...buildSoothBookSellRequest({
          marketAddress: input.marketAddress,
          outcome: input.outcome,
          tick,
          amount: input.shares,
          maxCost: input.maxCostOrMinProceeds,
        }),
      };
    }

    return {
      venue: 'soothbook',
      ...buildSoothBookBuyRequest({
        marketAddress: input.marketAddress,
        outcome: input.outcome,
        tick,
        amount: input.shares,
        escrow: input.escrow ?? false,
        maxCost: input.maxCostOrMinProceeds,
      }),
    };
  }

  return {
    venue: 'amm',
    ...buildLaunchpadTradeRequest({
      marketAddress: input.marketAddress,
      action: input.action,
      outcome: input.outcome,
      shares: input.shares,
      maxCostOrMinProceeds: input.maxCostOrMinProceeds,
    }),
  };
}

export function buildClaimRequest(
  snapshot: SoothCoreSnapshot,
  contracts: SoothCoreContracts,
): ClaimRequestPlan | null {
  if (snapshot.launchpadAmm.launchpad.isDismissed) {
    if (snapshot.launchpadAmm.launchpad.userLockedCost <= 0n) {
      return null;
    }

    return {
      route: 'dismissed_refund',
      requests: [
        {
          route: 'dismissed_refund',
          contract: contracts.launchpadEngine,
          functionName: 'claimRefund',
          args: [snapshot.marketAddress] as const,
        },
      ] as const,
    };
  }

  if (!snapshot.truth.isSettled && !snapshot.truth.isFinalized) {
    return null;
  }

  const soothBookYes = snapshot.soothBook?.userYesBalance ?? 0n;
  const soothBookNo = snapshot.soothBook?.userNoBalance ?? 0n;
  const hasSoothBookPosition = soothBookYes > 0n || soothBookNo > 0n;
  if (snapshot.soothBook?.isFinalized && hasSoothBookPosition) {
    // SoothBook has no redeem(): positions are custodied by OrderEngine
    // (unified custody). Redemption is OrderEngine.settlePosition(market),
    // which settles the caller's whole position and returns the payout.
    return {
      route: 'order_settle',
      requests: [
        {
          route: 'order_settle',
          contract: assertAddress('orderEngine', contracts.orderEngine),
          functionName: 'settlePosition',
          args: [snapshot.marketAddress] as const,
        },
      ] as const,
    };
  }

  if (snapshot.launchpadAmm.launchpad.isGraduated) {
    if (!snapshot.truth.isFinalized || !snapshot.collateralizer) {
      return null;
    }

    const yesBalance = snapshot.collateralizer.userYesBalance;
    const noBalance = snapshot.collateralizer.userNoBalance;
    const winningOutcome = snapshot.truth.winningOutcome;

    // OrderEngine (which replaced the Collateralizer) has no redeemOutcome().
    // Redemption is a single settlePosition(market) — it pays out the caller's
    // whole position for the settled outcome. We only need to check there is a
    // redeemable balance for the winning side (or either side, if INVALID).
    let hasRedeemable = false;
    if (winningOutcome === OUTCOME.INVALID) {
      hasRedeemable = yesBalance > 0n || noBalance > 0n;
    } else if (winningOutcome === OUTCOME.YES) {
      hasRedeemable = yesBalance > 0n;
    } else if (winningOutcome === OUTCOME.NO) {
      hasRedeemable = noBalance > 0n;
    }

    if (!hasRedeemable) {
      return null;
    }

    return {
      route: 'order_settle',
      requests: [
        {
          route: 'order_settle',
          contract: assertAddress('orderEngine', contracts.orderEngine),
          functionName: 'settlePosition',
          args: [snapshot.marketAddress] as const,
        },
      ] as const,
    };
  }

  const hasAmmPosition =
    snapshot.launchpadAmm.amm.userYesShares > 0n || snapshot.launchpadAmm.amm.userNoShares > 0n;
  if (!hasAmmPosition) {
    return null;
  }

  return {
    route: 'amm_settle',
    requests: [
      {
        route: 'amm_settle',
        contract: contracts.ammEngine,
        functionName: 'settlePosition',
        args: [snapshot.marketAddress] as const,
      },
    ] as const,
  };
}

export function preflightTrade(
  snapshot: SoothCoreSnapshot,
  input: TradePreflightInput,
): TradePreflightResult {
  if (input.outcome !== OUTCOME.NO && input.outcome !== OUTCOME.YES) {
    return { canTrade: false, reason: 'invalid_outcome' };
  }

  if (input.shares <= 0n) {
    return { canTrade: false, reason: 'invalid_shares' };
  }

  if (snapshot.launchpadAmm.launchpad.isDismissed) {
    return { canTrade: false, reason: 'market_dismissed' };
  }

  if (snapshot.truth.isSettled || snapshot.truth.isFinalized) {
    return { canTrade: false, reason: 'market_settled' };
  }

  if (snapshot.tradingVenue === 'soothbook' && !snapshot.soothBook?.isActive) {
    return { canTrade: false, reason: 'venue_unavailable' };
  }

  if (snapshot.tradingVenue === 'amm' && !snapshot.launchpadAmm.amm.isInitialized) {
    return { canTrade: false, reason: 'market_not_active' };
  }

  if (input.action === 'buy') {
    const required = input.maxCostOrMinProceeds ?? input.quotedTotal ?? 0n;
    if (required <= 0n) {
      return { canTrade: false, reason: 'invalid_guard' };
    }

    if (typeof input.userBalance === 'bigint' && input.userBalance < required) {
      return {
        canTrade: false,
        reason: 'insufficient_balance',
        required,
        available: input.userBalance,
      };
    }
  } else if (typeof input.maxCostOrMinProceeds === 'bigint' && input.maxCostOrMinProceeds <= 0n) {
    return { canTrade: false, reason: 'invalid_guard' };
  }

  return { canTrade: true };
}

export function buildApprovalRequest(input: BuildApprovalRequestInput): ApprovalRequest | null {
  if (input.amount <= 0n) {
    return null;
  }

  if (input.allowance >= input.amount) {
    return null;
  }

  return {
    contract: input.tokenAddress,
    functionName: 'approve',
    args: [input.spender, input.approveAmount ?? MAX_UINT256] as const,
    requiredAmount: input.amount,
    currentAllowance: input.allowance,
  };
}

export async function readApprovalRequest(
  client: PublicClient,
  input: ReadApprovalRequestInput,
): Promise<ApprovalRequest | null> {
  const allowance = (await client.readContract({
    address: input.tokenAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [input.owner, input.spender],
  })) as bigint;

  return buildApprovalRequest({
    tokenAddress: input.tokenAddress,
    spender: input.spender,
    amount: input.amount,
    allowance,
    approveAmount: input.approveAmount,
  });
}

export function createSoothCoreClient(config: CreateSoothCoreClientConfig): SoothCoreClient {
  const mode = config.mode ?? 'rpc';
  const indexedProvider =
    config.mode === 'indexed' ? config.indexedProvider : config.indexedProvider;
  const publicClient = config.mode === 'indexed' ? config.publicClient : config.publicClient;
  const contracts = config.mode === 'indexed' ? config.contracts : config.contracts;

  const requireRpc = (): {
    publicClient: PublicClient;
    contracts: SoothCoreContracts;
  } => {
    if (!publicClient || !contracts) {
      throw new Error('RPC mode requires publicClient and contracts');
    }
    return { publicClient, contracts };
  };

  const requireIndexed = (): SoothCoreDataProvider => {
    if (!indexedProvider) {
      throw new Error('Indexed mode requires indexedProvider');
    }
    return indexedProvider;
  };

  const getSnapshot = async (
    marketAddress: Address,
    options: SoothCoreSnapshotOptions = {},
  ): Promise<SoothCoreSnapshot> => {
    if (mode === 'indexed') {
      return requireIndexed().getSnapshot(marketAddress, options);
    }

    const rpc = requireRpc();
    return readSoothCoreSnapshot(rpc.publicClient, rpc.contracts, marketAddress, options);
  };

  const getSnapshots = async (
    marketAddresses: readonly Address[],
    options: SoothCoreSnapshotOptions = {},
  ): Promise<SoothCoreSnapshot[]> => {
    if (mode === 'indexed' && requireIndexed().getSnapshots) {
      return requireIndexed().getSnapshots!(marketAddresses, options);
    }

    if (mode === 'rpc') {
      const rpc = requireRpc();
      return readSoothCoreSnapshots(rpc.publicClient, rpc.contracts, marketAddresses, options);
    }

    return Promise.all(marketAddresses.map((marketAddress) => getSnapshot(marketAddress, options)));
  };

  const getQuote = async (
    marketAddress: Address,
    options: ReadSoothQuoteOptions,
  ): Promise<SoothQuote> => {
    if (mode === 'indexed' && requireIndexed().getQuote && !options.snapshot) {
      return requireIndexed().getQuote!(marketAddress, options);
    }

    const snapshot = options.snapshot ?? (await getSnapshot(marketAddress));
    if (mode === 'indexed') {
      if (!publicClient || !contracts) {
        throw new Error('Quote fallback in indexed mode requires publicClient and contracts');
      }
      return readSoothQuote(publicClient, contracts, marketAddress, {
        ...options,
        snapshot,
      });
    }

    const rpc = requireRpc();
    return readSoothQuote(rpc.publicClient, rpc.contracts, marketAddress, {
      ...options,
      snapshot,
    });
  };

  const getAmmQuote = async (
    snapshot: LaunchpadAmmMarketSnapshot,
    options: ReadLaunchpadAmmQuoteFromSnapshotOptions,
  ): Promise<LaunchpadAmmQuote> => {
    const rpc = requireRpc();
    return readLaunchpadAmmQuoteFromSnapshot(rpc.publicClient, rpc.contracts, snapshot, options);
  };

  const getSoothBookQuote = async (
    marketAddress: Address,
    options: ReadSoothBookQuoteOptions,
  ): Promise<SoothBookQuote> => {
    const rpc = requireRpc();
    return readSoothBookQuote(rpc.publicClient, rpc.contracts, marketAddress, options);
  };

  const listMarkets = async (): Promise<Address[]> => {
    if (requireIndexed().listMarkets) {
      return requireIndexed().listMarkets!();
    }
    throw new Error('listMarkets is only available when an indexed provider implements it');
  };

  return {
    mode,
    getSnapshot,
    getSnapshots,
    getQuote,
    getAmmQuote,
    getSoothBookQuote,
    computeSoothBookMaxCost,
    buildTrade: buildTradeRequest,
    buildSoothBookBuy: buildSoothBookBuyRequest,
    buildSoothBookSell: buildSoothBookSellRequest,
    buildSoothBookCancel: buildSoothBookCancelRequest,
    buildSoothBookCancelById: buildSoothBookCancelByIdRequest,
    buildSoothBookMint: buildSoothBookMintRequest,
    buildSoothBookMerge: buildSoothBookMergeRequest,
    buildSoothBookRedeem: buildSoothBookRedeemRequest,
    buildClaim: (snapshot: SoothCoreSnapshot) =>
      buildClaimRequest(snapshot, requireRpc().contracts),
    preflightTrade,
    readApprovalRequest: (input: ReadApprovalRequestInput) =>
      readApprovalRequest(requireRpc().publicClient, input),
    buildApprovalRequest,
    listMarkets,
  };
}

export const createSoothClient = createSoothCoreClient;

export function classifyTradeError(error: unknown): {
  code: string;
  message: string;
} {
  const message = error instanceof Error ? error.message : String(error ?? 'Unknown trade error');
  const lower = message.toLowerCase();

  if (lower.includes('insufficient') || lower.includes('erc20insufficientbalance')) {
    return { code: 'insufficient_balance', message };
  }

  if (
    lower.includes('slippage') ||
    lower.includes('maxcostorminproceeds') ||
    lower.includes('cost exceeds')
  ) {
    return { code: 'slippage_exceeded', message };
  }

  if (lower.includes('settled') || lower.includes('resolved') || lower.includes('finalized')) {
    return { code: 'market_settled', message };
  }

  if (lower.includes('rejected') || lower.includes('denied') || lower.includes('4001')) {
    return { code: 'user_rejected', message };
  }

  if (lower.includes('timeout') || lower.includes('timed out')) {
    return { code: 'network_timeout', message };
  }

  return { code: 'unknown', message };
}

export function resolveDefaultApprovalToken(snapshot: SoothCoreSnapshot): Address | null {
  if (snapshot.soothBook?.collateral && snapshot.soothBook.collateral !== ZERO_ADDRESS) {
    return snapshot.soothBook.collateral;
  }

  if (snapshot.collateralizer?.isRegistered) {
    // Collateralizer snapshots currently expose outcome token addresses, not collateral token.
    // Returning null makes the caller pass tokenAddress explicitly.
    return null;
  }

  return null;
}

export function getClaimAbiForRequest(request: ClaimTxRequest) {
  // Keyed on route, not functionName — order_settle and amm_settle both call
  // settlePosition(address) but on different contracts (OrderEngine vs AMMEngine).
  switch (request.route) {
    case 'dismissed_refund':
      return LaunchpadEngineABI;
    case 'order_settle':
      return OrderEngineABI;
    case 'amm_settle':
      return AMMEngineABI;
  }
}
