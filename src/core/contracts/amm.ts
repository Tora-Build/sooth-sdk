import type { PublicClient, Address } from 'viem';
import { AMMEngineABI } from '../abis/AMMEngine.js';

export interface AmmMarketState {
  address: Address;
  liquidity: bigint;
  isInitialized: boolean;
  qYes: bigint;
  qNo: bigint;
  yesPrice: bigint;
  noPrice: bigint;
  yesProbability: number;
  noProbability: number;
}

export interface AmmPosition {
  yesShares: bigint;
  noShares: bigint;
}

export interface AmmQuote {
  cost: bigint;
  newPrice: bigint;
}

const WAD = 10n ** 18n;

/**
 * Fetch AMM market state (liquidity, prices, quantities).
 */
export async function getAmmMarketState(
  client: PublicClient,
  ammEngine: Address,
  marketAddress: Address,
): Promise<AmmMarketState> {
  const liquidity = (await client.readContract({
    address: ammEngine,
    abi: AMMEngineABI,
    functionName: 'getLiquidity',
    args: [marketAddress],
  })) as bigint;

  const isInitialized = liquidity > 0n;
  let qYes = 0n;
  let qNo = 0n;
  let yesPrice = WAD / 2n;

  if (isInitialized) {
    const state = (await client.readContract({
      address: ammEngine,
      abi: AMMEngineABI,
      functionName: 'getMarketState',
      args: [marketAddress],
    })) as readonly [bigint, bigint, bigint];
    [qYes, qNo, yesPrice] = state;
  }

  const noPrice = yesPrice <= WAD ? WAD - yesPrice : 0n;

  return {
    address: marketAddress,
    liquidity,
    isInitialized,
    qYes,
    qNo,
    yesPrice,
    noPrice,
    yesProbability: Number(yesPrice) / 1e18,
    noProbability: Number(noPrice) / 1e18,
  };
}

/**
 * Fetch user's AMM position (YES and NO shares).
 */
export async function getAmmPosition(
  client: PublicClient,
  ammEngine: Address,
  marketAddress: Address,
  userAddress: Address,
): Promise<AmmPosition> {
  const result = (await client.readContract({
    address: ammEngine,
    abi: AMMEngineABI,
    functionName: 'getPosition',
    args: [marketAddress, userAddress],
  })) as readonly [bigint, bigint];

  return { yesShares: result[0], noShares: result[1] };
}

/**
 * Get a quote for an AMM trade.
 */
export async function getAmmQuote(
  client: PublicClient,
  ammEngine: Address,
  marketAddress: Address,
  outcome: 0 | 1,
  deltaShares: bigint,
): Promise<AmmQuote> {
  const result = (await client.readContract({
    address: ammEngine,
    abi: AMMEngineABI,
    functionName: 'getPositionQuote',
    args: [marketAddress, outcome, deltaShares],
  })) as readonly [bigint, bigint, bigint, bigint];

  return { cost: result[0], newPrice: result[3] };
}
