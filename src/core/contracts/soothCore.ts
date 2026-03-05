import { encodePacked, keccak256, type Address, type PublicClient } from 'viem';
import { CollateralizerABI } from '../abis/Collateralizer.js';
import { SoothBookABI } from '../abis/SoothBook.js';
import { TruthMarketABI } from '../abis/TruthMarket.js';
import {
  OUTCOME,
  readLaunchpadAmmSnapshot,
  type BinaryOutcome,
  type LaunchpadAmmContracts,
  type LaunchpadAmmMarketSnapshot,
  type LaunchpadAmmSnapshotOptions,
  type SoothTradeAction,
} from './launchpadAmm.js';

export type SoothTradingVenue = 'amm' | 'soothbook';

const WAD = 10n ** 18n;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

export interface SoothCoreContracts extends LaunchpadAmmContracts {
  soothBook?: Address;
  collateralizer?: Address;
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
  maxCost: bigint;
}

type SoothBookMarketTuple = readonly [Address, Address, Address, boolean, boolean, number];

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

  const hasActiveSoothBook = !!snapshot.soothBook && snapshot.soothBook.isActive && !snapshot.soothBook.isFinalized;
  if (snapshot.launchpadAmm.launchpad.isGraduated && hasActiveSoothBook) {
    return 'soothbook';
  }

  return 'amm';
}

export async function readTruthMarketSnapshot(
  client: PublicClient,
  marketAddress: Address,
  options: { includeQuestion?: boolean } = {},
): Promise<SoothTruthMarketSnapshot> {
  const [creator, deadline, winningOutcome, isSettled, isFinalized, isLive, question] = await Promise.all([
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
          functionName: 'isFinalized',
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
              functionName: 'question',
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
    isFinalized,
    isLive,
    question,
  };
}

export async function readCollateralizerSnapshot(
  client: PublicClient,
  collateralizer: Address,
  marketAddress: Address,
  userAddress?: Address,
): Promise<SoothCollateralizerSnapshot> {
  const [isRegistered, isSettled, totalCollateral, outcomeTokens, balances] = await Promise.all([
    readWithFallback(
      () =>
        client.readContract({
          address: collateralizer,
          abi: CollateralizerABI,
          functionName: 'isMarketRegistered',
          args: [marketAddress],
        }) as Promise<boolean>,
      false,
    ),
    readWithFallback(
      () =>
        client.readContract({
          address: collateralizer,
          abi: CollateralizerABI,
          functionName: 'isMarketSettled',
          args: [marketAddress],
        }) as Promise<boolean>,
      false,
    ),
    readWithFallback(
      () =>
        client.readContract({
          address: collateralizer,
          abi: CollateralizerABI,
          functionName: 'getTotalCollateral',
          args: [marketAddress],
        }) as Promise<bigint>,
      0n,
    ),
    readWithFallback(
      () =>
        client.readContract({
          address: collateralizer,
          abi: CollateralizerABI,
          functionName: 'getOutcomeTokens',
          args: [marketAddress],
        }) as Promise<readonly [Address, Address]>,
      [ZERO_ADDRESS, ZERO_ADDRESS] as const,
    ),
    userAddress
      ? readWithFallback(
          () =>
            client.readContract({
              address: collateralizer,
              abi: CollateralizerABI,
              functionName: 'getBalances',
              args: [marketAddress, userAddress],
            }) as Promise<readonly [bigint, bigint]>,
          [0n, 0n] as const,
        )
      : Promise.resolve([0n, 0n] as const),
  ]);

  return {
    isRegistered,
    isSettled,
    totalCollateral,
    yesToken: outcomeTokens[0],
    noToken: outcomeTokens[1],
    userYesBalance: balances[0],
    userNoBalance: balances[1],
  };
}

export async function readSoothBookMarketSnapshot(
  client: PublicClient,
  soothBook: Address,
  marketAddress: Address,
  userAddress?: Address,
): Promise<SoothBookMarketSnapshot | null> {
  const marketKey = computeSoothMarketKey(marketAddress);
  const emptyMarket: SoothBookMarketTuple = [ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, false, false, Number(OUTCOME.INVALID)];

  const [marketTuple, impliedPrice, bestYesTickRaw, bestNoTickRaw, backing, feeBps, userBalances] = await Promise.all([
    readWithFallback(
      () =>
        client.readContract({
          address: soothBook,
          abi: SoothBookABI,
          functionName: 'markets',
          args: [marketKey],
        }) as Promise<SoothBookMarketTuple>,
      emptyMarket,
    ),
    readWithFallback(
      () =>
        client.readContract({
          address: soothBook,
          abi: SoothBookABI,
          functionName: 'getImpliedPrice',
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

  const [collateral, yesToken, noToken, isActive, isFinalized, outcome] = marketTuple;
  const exists = collateral !== ZERO_ADDRESS && yesToken !== ZERO_ADDRESS && noToken !== ZERO_ADDRESS;
  if (!exists && !isActive && !isFinalized) {
    return null;
  }

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

export async function readSoothCoreSnapshot(
  client: PublicClient,
  contracts: SoothCoreContracts,
  marketAddress: Address,
  options: SoothCoreSnapshotOptions = {},
): Promise<SoothCoreSnapshot> {
  const marketKey = computeSoothMarketKey(marketAddress);

  const [truth, launchpadAmm, collateralizer, soothBook] = await Promise.all([
    readTruthMarketSnapshot(client, marketAddress, { includeQuestion: options.includeQuestion }),
    readLaunchpadAmmSnapshot(client, contracts, marketAddress, options),
    contracts.collateralizer
      ? readCollateralizerSnapshot(client, contracts.collateralizer, marketAddress, options.userAddress)
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
  return {
    marketKey,
    functionName: input.outcome === OUTCOME.YES ? 'buyYes' : 'buyNo',
    args: [marketKey, input.tick, input.amount, input.escrow ?? false, input.maxCost] as const,
  };
}
