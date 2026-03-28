import type { Address, PublicClient } from 'viem';
import { AMMEngineABI } from '../abis/AMMEngine.js';
import { LaunchpadEngineABI } from '../abis/LaunchpadEngine.js';

export const OUTCOME = {
  NO: 0,
  YES: 1,
  INVALID: 2,
} as const;

export type BinaryOutcome = typeof OUTCOME.NO | typeof OUTCOME.YES;
export type SoothTradeAction = 'buy' | 'sell';
export type SoothMarketStage = 'bonding' | 'live' | 'settled' | 'finalized' | 'dismissed';

const WAD = 10n ** 18n;
const BPS_DENOMINATOR = 10_000n;
const DEFAULT_PRE_GRAD_FEE_BPS = 500n;
const DEFAULT_POST_GRAD_FEE_BPS = 100n;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

export interface LaunchpadAmmContracts {
  launchpadEngine: Address;
  ammEngine: Address;
}

export interface LaunchpadAmmSnapshotOptions {
  userAddress?: Address;
  nowSeconds?: bigint;
  isSettled?: boolean;
  isFinalized?: boolean;
}

export interface LaunchpadAmmMarketSnapshot {
  marketAddress: Address;
  stage: SoothMarketStage;
  amm: {
    liquidity: bigint;
    isInitialized: boolean;
    qYes: bigint;
    qNo: bigint;
    yesPriceWad: bigint;
    noPriceWad: bigint;
    yesProbability: number;
    noProbability: number;
    maxSafeTradeSharesWad: bigint;
    userYesShares: bigint;
    userNoShares: bigint;
  };
  launchpad: {
    creator: Address;
    lpToken: Address;
    bBase: bigint;
    bCurrent: bigint;
    creatorDeposit: bigint;
    feesAccrued: bigint;
    graduationThreshold: bigint;
    graduationProgressBps: bigint;
    totalLPSupply: bigint;
    lpYieldPool: bigint;
    floorValue: bigint;
    createdAt: bigint;
    graduatedAt: bigint;
    isGraduated: boolean;
    preGradFeeBps: bigint;
    postGradFeeBps: bigint;
    currentFeeBps: bigint;
    trialEndTime: bigint;
    isDismissed: boolean;
    totalLockedCost: bigint;
    userLockedCost: bigint;
    isInTrialPeriod: boolean;
    trialTimeRemainingSeconds: number;
  };
}

export interface LaunchpadAmmQuote {
  action: SoothTradeAction;
  outcome: BinaryOutcome;
  shares: bigint;
  deltaShares: bigint;
  rawQuote: bigint;
  feeBps: bigint;
  fee: bigint;
  total: bigint;
  proceeds: bigint;
  newPriceYes: number;
  newPriceNo: number;
  newPriceForOutcome: number;
  priceImpactPct: number;
}

export interface ApplySlippageInput {
  action: SoothTradeAction;
  amount: bigint;
  slippageBps: bigint | number;
}

export interface ComputeLaunchpadAmmQuoteInput {
  action: SoothTradeAction;
  outcome: BinaryOutcome;
  shares: bigint;
  rawQuote: bigint;
  newPriceYesWad: bigint;
  feeBps: bigint;
  currentYesPrice?: number;
}

export interface ReadLaunchpadAmmQuoteOptions {
  action: SoothTradeAction;
  outcome: BinaryOutcome;
  shares: bigint;
  feeBps?: bigint;
  preGradFeeBps?: bigint;
  postGradFeeBps?: bigint;
  isGraduated?: boolean;
  currentYesPrice?: number;
}

export interface ReadLaunchpadAmmQuoteFromSnapshotOptions {
  action: SoothTradeAction;
  outcome: BinaryOutcome;
  shares: bigint;
}

type LaunchpadMarketsMapping = readonly [
  Address,   // creator
  Address,   // lpToken
  bigint,    // bBase
  bigint,    // creatorDeposit
  bigint,    // graduatedAt
];

type AmmMarketState = readonly [bigint, bigint, bigint];
type AmmPosition = readonly [bigint, bigint];
type AmmQuote = readonly [bigint, bigint, bigint, bigint];

function clampProbability(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/**
 * Converts a quoted amount into on-chain slippage guard:
 * - buy: maxCost = amount * (1 + slippageBps)
 * - sell: minProceeds = amount * (1 - slippageBps)
 */
export function applySlippageToAmount(input: ApplySlippageInput): bigint {
  const bps = typeof input.slippageBps === 'bigint' ? input.slippageBps : BigInt(input.slippageBps);
  if (bps < 0n) throw new Error('slippageBps must be >= 0');
  if (bps > BPS_DENOMINATOR) throw new Error('slippageBps must be <= 10000');

  if (input.action === 'buy') {
    return input.amount + (input.amount * bps) / BPS_DENOMINATOR;
  }

  const buffered = input.amount - (input.amount * bps) / BPS_DENOMINATOR;
  return buffered > 0n ? buffered : 0n;
}

function toRatio(numerator: bigint, denominator: bigint): number {
  if (denominator === 0n) return 0;
  const maxMagnitude = denominator * 700n;
  if (numerator > maxMagnitude) return 700;
  if (numerator < -maxMagnitude) return -700;
  return Number(numerator) / Number(denominator);
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

/**
 * Canonical outcome probability using stable log-sum-exp.
 */
export function computeLmsrYesProbability(qYes: bigint, qNo: bigint, b: bigint): number {
  if (b <= 0n) return 0.5;
  const qMax = qYes > qNo ? qYes : qNo;
  const yesArg = toRatio(qYes - qMax, b);
  const noArg = toRatio(qNo - qMax, b);
  const expYes = Math.exp(yesArg);
  const expNo = Math.exp(noArg);
  const denominator = expYes + expNo;
  if (!Number.isFinite(denominator) || denominator <= 0) return 0.5;
  return clampProbability(expYes / denominator);
}

export function resolveSoothMarketStage(flags: {
  isDismissed: boolean;
  isFinalized: boolean;
  isSettled: boolean;
  isGraduated: boolean;
}): SoothMarketStage {
  if (flags.isDismissed) return 'dismissed';
  if (flags.isFinalized) return 'finalized';
  if (flags.isSettled) return 'settled';
  if (flags.isGraduated) return 'live';
  return 'bonding';
}

export function getLaunchpadFeeBps(
  isGraduated: boolean,
  preGradFeeBps: bigint = DEFAULT_PRE_GRAD_FEE_BPS,
  postGradFeeBps: bigint = DEFAULT_POST_GRAD_FEE_BPS,
): bigint {
  return isGraduated ? postGradFeeBps : preGradFeeBps;
}

/**
 * Normalizes raw AMM quote + Launchpad fee model into a single shape for all app frontends.
 */
export function computeLaunchpadAmmQuote(input: ComputeLaunchpadAmmQuoteInput): LaunchpadAmmQuote {
  const deltaShares = input.action === 'buy' ? input.shares : -input.shares;
  const fee = (input.rawQuote * input.feeBps) / BPS_DENOMINATOR;
  const proceeds = input.rawQuote > fee ? input.rawQuote - fee : 0n;
  const total = input.action === 'buy' ? input.rawQuote + fee : proceeds;

  const newPriceYes = clampProbability(Number(input.newPriceYesWad) / 1e18);
  const newPriceNo = clampProbability(1 - newPriceYes);
  const newPriceForOutcome = input.outcome === OUTCOME.YES ? newPriceYes : newPriceNo;

  let priceImpactPct = 0;
  if (typeof input.currentYesPrice === 'number') {
    const currentYes = clampProbability(input.currentYesPrice);
    const currentForOutcome = input.outcome === OUTCOME.YES ? currentYes : clampProbability(1 - currentYes);
    if (currentForOutcome > 0) {
      const rawImpact = ((newPriceForOutcome - currentForOutcome) / currentForOutcome) * 100;
      priceImpactPct = Math.max(-99.99, Math.min(99.99, rawImpact));
    }
  }

  return {
    action: input.action,
    outcome: input.outcome,
    shares: input.shares,
    deltaShares,
    rawQuote: input.rawQuote,
    feeBps: input.feeBps,
    fee,
    total,
    proceeds,
    newPriceYes,
    newPriceNo,
    newPriceForOutcome,
    priceImpactPct,
  };
}

/**
 * Reads AMM + Launchpad state and returns a canonical market snapshot for app surfaces.
 */
export async function readLaunchpadAmmSnapshot(
  client: PublicClient,
  contracts: LaunchpadAmmContracts,
  marketAddress: Address,
  options: LaunchpadAmmSnapshotOptions = {},
): Promise<LaunchpadAmmMarketSnapshot> {
  const emptyMarketsMapping: LaunchpadMarketsMapping = [
    ZERO_ADDRESS,
    ZERO_ADDRESS,
    0n,
    0n,
    0n,
  ];
  const emptyAmmState: AmmMarketState = [0n, 0n, WAD / 2n];

  const [
    liquidity,
    marketsMapping,
    isGraduated,
    userPosition,
  ] = await Promise.all([
    client.readContract({
      address: contracts.ammEngine,
      abi: AMMEngineABI,
      functionName: 'getLiquidity',
      args: [marketAddress],
    }) as Promise<bigint>,
    readWithFallback(
      () =>
        client.readContract({
          address: contracts.launchpadEngine,
          abi: LaunchpadEngineABI,
          functionName: 'markets',
          args: [marketAddress],
        }) as Promise<LaunchpadMarketsMapping>,
      emptyMarketsMapping,
    ),
    readWithFallback(
      () =>
        client.readContract({
          address: contracts.launchpadEngine,
          abi: LaunchpadEngineABI,
          functionName: 'isGraduated',
          args: [marketAddress],
        }) as Promise<boolean>,
      false,
    ),
    options.userAddress
      ? readWithFallback(
          () =>
            client.readContract({
              address: contracts.ammEngine,
              abi: AMMEngineABI,
              functionName: 'getPosition',
              args: [marketAddress, options.userAddress!],
            }) as Promise<AmmPosition>,
          [0n, 0n] as const,
        )
      : Promise.resolve([0n, 0n] as const),
  ]);

  const isInitialized = liquidity > 0n;
  const ammState = isInitialized
    ? await readWithFallback(
        () =>
          client.readContract({
            address: contracts.ammEngine,
            abi: AMMEngineABI,
            functionName: 'getMarketState',
            args: [marketAddress],
          }) as Promise<AmmMarketState>,
        emptyAmmState,
      )
    : emptyAmmState;

  const [qYes, qNo, yesPriceWad] = ammState;
  const [userYesShares, userNoShares] = userPosition;
  const noPriceWad = yesPriceWad <= WAD ? WAD - yesPriceWad : 0n;
  const yesProbability = clampProbability(Number(yesPriceWad) / 1e18);
  const noProbability = clampProbability(1 - yesProbability);
  const maxSafeTradeSharesWad = liquidity > 0n ? liquidity * 45n : 0n;

  const creator = marketsMapping[0];
  const lpToken = marketsMapping[1];
  const bBase = marketsMapping[2];
  const creatorDeposit = marketsMapping[3];
  const graduatedAt = marketsMapping[4];

  const preGradFeeBpsBig = DEFAULT_PRE_GRAD_FEE_BPS;
  const postGradFeeBpsBig = DEFAULT_POST_GRAD_FEE_BPS;
  const currentFeeBps = getLaunchpadFeeBps(isGraduated, preGradFeeBpsBig, postGradFeeBpsBig);

  const isDismissed = false; // trialStates removed in v0.1.0
  const stage = resolveSoothMarketStage({
    isDismissed,
    isSettled: options.isSettled ?? false,
    isFinalized: options.isFinalized ?? false,
    isGraduated,
  });

  return {
    marketAddress,
    stage,
    amm: {
      liquidity,
      isInitialized,
      qYes,
      qNo,
      yesPriceWad,
      noPriceWad,
      yesProbability,
      noProbability,
      maxSafeTradeSharesWad,
      userYesShares,
      userNoShares,
    },
    launchpad: {
      creator,
      lpToken,
      bBase,
      bCurrent: 0n,
      creatorDeposit,
      feesAccrued: 0n,
      graduationThreshold: 0n,
      graduationProgressBps: 0n,
      totalLPSupply: 0n,
      lpYieldPool: 0n,
      floorValue: 0n,
      createdAt: 0n,
      graduatedAt,
      isGraduated,
      preGradFeeBps: preGradFeeBpsBig,
      postGradFeeBps: postGradFeeBpsBig,
      currentFeeBps,
      trialEndTime: 0n,
      isDismissed,
      totalLockedCost: 0n,
      userLockedCost: 0n,
      isInTrialPeriod: false,
      trialTimeRemainingSeconds: 0,
    },
  };
}

/**
 * Reads an AMM quote and applies canonical Launchpad fee logic.
 */
export async function readLaunchpadAmmQuote(
  client: PublicClient,
  contracts: LaunchpadAmmContracts,
  marketAddress: Address,
  options: ReadLaunchpadAmmQuoteOptions,
): Promise<LaunchpadAmmQuote> {
  if (options.shares <= 0n) {
    throw new Error('shares must be greater than zero');
  }

  const deltaShares = options.action === 'buy' ? options.shares : -options.shares;
  const [rawQuote, , , newPriceYesWad] = (await client.readContract({
    address: contracts.ammEngine,
    abi: AMMEngineABI,
    functionName: 'getPositionQuote',
    args: [marketAddress, options.outcome, deltaShares],
  })) as AmmQuote;

  let feeBps = options.feeBps;
  if (feeBps === undefined) {
    const preGradFeeBps = options.preGradFeeBps ?? DEFAULT_PRE_GRAD_FEE_BPS;
    const postGradFeeBps = options.postGradFeeBps ?? DEFAULT_POST_GRAD_FEE_BPS;

    const isGraduated = options.isGraduated
      ?? await readWithFallback(
        () =>
          client.readContract({
            address: contracts.launchpadEngine,
            abi: LaunchpadEngineABI,
            functionName: 'isGraduated',
            args: [marketAddress],
          }) as Promise<boolean>,
        false,
      );

    feeBps = getLaunchpadFeeBps(isGraduated, toBigInt(preGradFeeBps), toBigInt(postGradFeeBps));
  }

  return computeLaunchpadAmmQuote({
    action: options.action,
    outcome: options.outcome,
    shares: options.shares,
    rawQuote,
    newPriceYesWad,
    feeBps,
    currentYesPrice: options.currentYesPrice,
  });
}

/**
 * Snapshot-based quote convenience to avoid recomputing fee/price inputs in app code.
 */
export async function readLaunchpadAmmQuoteFromSnapshot(
  client: PublicClient,
  contracts: LaunchpadAmmContracts,
  snapshot: LaunchpadAmmMarketSnapshot,
  options: ReadLaunchpadAmmQuoteFromSnapshotOptions,
): Promise<LaunchpadAmmQuote> {
  return readLaunchpadAmmQuote(client, contracts, snapshot.marketAddress, {
    action: options.action,
    outcome: options.outcome,
    shares: options.shares,
    feeBps: snapshot.launchpad.currentFeeBps,
    currentYesPrice: snapshot.amm.yesProbability,
  });
}
