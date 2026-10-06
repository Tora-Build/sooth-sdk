import { erc20Abi, parseAbi, type Address, type PublicClient } from 'viem';
import { AMMEngineABI } from '../abis/AMMEngine.js';
import { FeeRouterABI } from '../abis/FeeRouter.js';
import { FeeVaultABI } from '../abis/FeeVault.js';
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
    /** LP yield in WAD for both FeeRouter and FeeVault deployments. */
    lpYieldPool: bigint;
    /** Null because v0.2.1 exposes no public getter for AMMEngine's LP floor calculation. */
    floorValue: bigint | null;
    /** Null because creation time is only available from historical MarketCreated logs. */
    createdAt: bigint | null;
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
  /**
   * Optional fee returned by AMMEngine.getPositionQuote (2nd return value).
   * When provided, this is used verbatim — it's authoritative and removes
   * the need to guess feeBps. Without it, fee is recomputed from feeBps.
   */
  contractFee?: bigint;
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
  Address, // creator
  Address, // lpToken
  bigint, // bBase
  bigint, // creatorDeposit
  bigint, // graduatedAt
];

type AmmMarketState = readonly [bigint, bigint, bigint];
type AmmPosition = readonly [bigint, bigint];
type AmmQuote = readonly [bigint, bigint, bigint, bigint];
type FeeState = readonly [bigint, bigint, bigint, boolean];
type GraduationProgress = readonly [bigint, bigint, bigint];

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

const FEE_VAULT_GETTER = parseAbi(['function feeVault() view returns (address)']);

type VaultFeeConfig = {
  preGradFeeBps: number | bigint;
  postGradFeeBps: number | bigint;
  ammToken: Address;
};

interface FeeLayer {
  bCurrent: bigint;
  feesAccrued: bigint;
  lpYieldPool: bigint;
  graduationThreshold: bigint;
  graduationProgressBps: bigint;
  preGradFeeBps: bigint;
  postGradFeeBps: bigint;
}

/** feeRouter() reverts on core 0.4.0, where the getter was renamed feeVault(). */
function isMissingFeeRouter(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /revert|returned no data|selector|unexpected read: feeRouter/i.test(message);
}

async function readFeeLayer(
  client: PublicClient,
  ammEngine: Address,
  marketAddress: Address,
  liquidity: bigint,
): Promise<FeeLayer> {
  try {
    const feeRouter = (await client.readContract({
      address: ammEngine,
      abi: AMMEngineABI,
      functionName: 'feeRouter',
    })) as Address;
    const [feeState, graduationProgress, preGradFeeBps, postGradFeeBps] = await Promise.all([
      client.readContract({
        address: feeRouter,
        abi: FeeRouterABI,
        functionName: 'getFeeState',
        args: [marketAddress],
      }) as Promise<FeeState>,
      client.readContract({
        address: feeRouter,
        abi: FeeRouterABI,
        functionName: 'getGraduationProgress',
        args: [marketAddress],
      }) as Promise<GraduationProgress>,
      client.readContract({
        address: feeRouter,
        abi: FeeRouterABI,
        functionName: 'preGradFeeBps',
      }) as Promise<number | bigint>,
      client.readContract({
        address: feeRouter,
        abi: FeeRouterABI,
        functionName: 'postGradFeeBps',
      }) as Promise<number | bigint>,
    ]);
    const [bCurrent, feesAccrued, lpYieldPool] = feeState;
    const [, graduationThreshold, graduationProgressBps] = graduationProgress;
    return {
      bCurrent,
      feesAccrued,
      lpYieldPool,
      graduationThreshold,
      graduationProgressBps,
      preGradFeeBps: toBigInt(preGradFeeBps),
      postGradFeeBps: toBigInt(postGradFeeBps),
    };
  } catch (error) {
    if (!isMissingFeeRouter(error)) throw error;
  }

  const feeVault = (await client.readContract({
    address: ammEngine,
    abi: FEE_VAULT_GETTER,
    functionName: 'feeVault',
  })) as Address;
  const [config, progress] = await Promise.all([
    client.readContract({
      address: feeVault,
      abi: FeeVaultABI,
      functionName: 'configOf',
      args: [marketAddress],
    }) as Promise<VaultFeeConfig>,
    client.readContract({
      address: feeVault,
      abi: FeeVaultABI,
      functionName: 'graduationProgress',
      args: [marketAddress],
    }) as Promise<readonly [bigint, bigint]>,
  ]);
  const accruedWad = progress[0];
  const thresholdWad = progress[1];
  const uncapped = thresholdWad > 0n ? (accruedWad * BPS_DENOMINATOR) / thresholdWad : 0n;
  const [lpYieldPoolNative, ammTokenDecimals] = await Promise.all([
    client.readContract({
      address: feeVault,
      abi: FeeVaultABI,
      functionName: 'accountOf',
      args: [marketAddress, 1, config.ammToken],
    }),
    client.readContract({
      address: config.ammToken,
      abi: erc20Abi,
      functionName: 'decimals',
    }),
  ]);
  // FeeVault accounts use native units; preserve FeeRouter's WAD snapshot units.
  const lpYieldPool = (lpYieldPoolNative * WAD) / 10n ** BigInt(ammTokenDecimals);
  return {
    bCurrent: liquidity,
    feesAccrued: accruedWad,
    lpYieldPool,
    graduationThreshold: thresholdWad,
    graduationProgressBps: uncapped > BPS_DENOMINATOR ? BPS_DENOMINATOR : uncapped,
    preGradFeeBps: toBigInt(config.preGradFeeBps),
    postGradFeeBps: toBigInt(config.postGradFeeBps),
  };
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
  // Prefer the contract-reported fee when caller supplies it (matches the
  // exact value tradePositions will charge). Fall back to feeBps math.
  const fee = input.contractFee ?? (input.rawQuote * input.feeBps) / BPS_DENOMINATOR;
  const proceeds = input.rawQuote > fee ? input.rawQuote - fee : 0n;
  const total = input.action === 'buy' ? input.rawQuote + fee : proceeds;

  const newPriceYes = clampProbability(Number(input.newPriceYesWad) / 1e18);
  const newPriceNo = clampProbability(1 - newPriceYes);
  const newPriceForOutcome = input.outcome === OUTCOME.YES ? newPriceYes : newPriceNo;

  let priceImpactPct = 0;
  if (typeof input.currentYesPrice === 'number') {
    const currentYes = clampProbability(input.currentYesPrice);
    const currentForOutcome =
      input.outcome === OUTCOME.YES ? currentYes : clampProbability(1 - currentYes);
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
  const emptyMarketsMapping: LaunchpadMarketsMapping = [ZERO_ADDRESS, ZERO_ADDRESS, 0n, 0n, 0n];
  const emptyAmmState: AmmMarketState = [0n, 0n, WAD / 2n];

  const [liquidity, marketsMapping, isGraduated, userPosition] = await Promise.all([
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

  const [fees, totalLPSupply] = await Promise.all([
    readFeeLayer(client, contracts.ammEngine, marketAddress, liquidity),
    lpToken !== ZERO_ADDRESS
      ? (client.readContract({
          address: lpToken,
          abi: erc20Abi,
          functionName: 'totalSupply',
        }) as Promise<bigint>)
      : Promise.resolve(0n),
  ]);
  const {
    bCurrent,
    feesAccrued,
    lpYieldPool,
    graduationThreshold,
    graduationProgressBps,
    preGradFeeBps: preGradFeeBpsBig,
    postGradFeeBps: postGradFeeBpsBig,
  } = fees;
  const currentFeeBps = getLaunchpadFeeBps(isGraduated, preGradFeeBpsBig, postGradFeeBpsBig);

  // Dismiss removed in v0.1.2 — isDismissed always false.
  // Trial period still tracked via trialEndTimes(address).
  const isDismissed = false;
  let trialEndTime = 0n;
  try {
    trialEndTime = (await client.readContract({
      address: contracts.launchpadEngine,
      abi: LaunchpadEngineABI,
      functionName: 'trialEndTimes',
      args: [marketAddress],
    })) as bigint;
  } catch {
    // trialEndTimes may not exist on older deploys
  }
  const now = options.nowSeconds ?? BigInt(Math.floor(Date.now() / 1000));
  const isInTrialPeriod = trialEndTime > 0n && now < trialEndTime && !isGraduated;
  const trialTimeRemainingSeconds = trialEndTime > now ? Number(trialEndTime - now) : 0;

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
      bCurrent,
      creatorDeposit,
      feesAccrued,
      graduationThreshold,
      graduationProgressBps,
      totalLPSupply,
      lpYieldPool,
      floorValue: null,
      createdAt: null,
      graduatedAt,
      isGraduated,
      preGradFeeBps: preGradFeeBpsBig,
      postGradFeeBps: postGradFeeBpsBig,
      currentFeeBps,
      trialEndTime,
      isDismissed,
      totalLockedCost: 0n,
      userLockedCost: 0n,
      isInTrialPeriod,
      trialTimeRemainingSeconds,
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
  // getPositionQuote returns (cost, fee, netAmount, newPrice). The
  // contract-reported `fee` is authoritative — it's exactly what
  // tradePositions will charge. Earlier code discarded it and
  // recomputed fee from a guessed feeBps default; if the deployed
  // FeeRouter's actual rate differs, the preview's `total` ends up
  // below the contract's required maxCost and the trade reverts with
  // "slippage exceeded" even on near-zero-impact trades.
  const [rawQuote, contractFee, , newPriceYesWad] = (await client.readContract({
    address: contracts.ammEngine,
    abi: AMMEngineABI,
    functionName: 'getPositionQuote',
    args: [marketAddress, options.outcome, deltaShares],
  })) as AmmQuote;

  let feeBps = options.feeBps;
  if (feeBps === undefined) {
    const preGradFeeBps = options.preGradFeeBps ?? DEFAULT_PRE_GRAD_FEE_BPS;
    const postGradFeeBps = options.postGradFeeBps ?? DEFAULT_POST_GRAD_FEE_BPS;

    const isGraduated =
      options.isGraduated ??
      (await readWithFallback(
        () =>
          client.readContract({
            address: contracts.launchpadEngine,
            abi: LaunchpadEngineABI,
            functionName: 'isGraduated',
            args: [marketAddress],
          }) as Promise<boolean>,
        false,
      ));

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
    contractFee,
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
