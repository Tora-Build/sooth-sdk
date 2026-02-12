import type { PublicClient, Address } from 'viem';
import { LaunchpadEngineABI } from '../abis/LaunchpadEngine.js';
import { TruthMarketABI } from '../abis/TruthMarket.js';

export interface SdkMarket {
  address: Address;
  question: string;
  creator: Address;
  lpToken: Address;
  isGraduated: boolean;
  isSettled: boolean;
  isFinalized: boolean;
  isDismissed: boolean;
  winningOutcome: number | null;
  createdAt: bigint;
  bBase: bigint;
  bCurrent: bigint;
  creatorDeposit: bigint;
  stage: 'bonding' | 'live' | 'settled' | 'finalized' | 'dismissed';
}

/**
 * Fetch all market addresses from LaunchpadEngine.
 */
export async function getMarketAddresses(
  client: PublicClient,
  launchpadEngine: Address
): Promise<Address[]> {
  const result = await client.readContract({
    address: launchpadEngine,
    abi: LaunchpadEngineABI,
    functionName: 'getMarkets',
  });
  return [...(result as Address[])];
}

/**
 * Fetch full market details for a single market address.
 */
export async function getMarketDetails(
  client: PublicClient,
  launchpadEngine: Address,
  marketAddress: Address
): Promise<SdkMarket | null> {
  try {
    const marketsMapping = await client.readContract({
      address: launchpadEngine,
      abi: LaunchpadEngineABI,
      functionName: 'markets',
      args: [marketAddress],
    }) as readonly [Address, Address, bigint, bigint, bigint, bigint, bigint, bigint, boolean, bigint, bigint];

    const [
      creator, lpToken, bBase, bCurrent, creatorDeposit,
      , , , isGraduated, createdAt,
    ] = marketsMapping;

    // Fetch question + settlement state
    const [question, isSettled, isFinalized, trialState, winOutcome] = await Promise.all([
      client.readContract({ address: marketAddress, abi: TruthMarketABI, functionName: 'question' }).catch(() => marketAddress.slice(2, 10).toUpperCase()),
      client.readContract({ address: marketAddress, abi: TruthMarketABI, functionName: 'isSettled' }).catch(() => false),
      client.readContract({ address: marketAddress, abi: TruthMarketABI, functionName: 'isFinalized' }).catch(() => false),
      client.readContract({ address: launchpadEngine, abi: LaunchpadEngineABI, functionName: 'trialStates', args: [marketAddress] }).catch(() => null),
      client.readContract({ address: marketAddress, abi: TruthMarketABI, functionName: 'winningOutcome' }).catch(() => null),
    ]);

    const isDismissed = trialState ? (trialState as readonly [bigint, boolean, bigint])[1] : false;
    const winningOutcome = (isSettled || isFinalized) && winOutcome !== null ? Number(winOutcome) : null;

    let stage: SdkMarket['stage'];
    if (isDismissed) stage = 'dismissed';
    else if (isFinalized as boolean) stage = 'finalized';
    else if (isSettled as boolean) stage = 'settled';
    else if (isGraduated) stage = 'live';
    else stage = 'bonding';

    return {
      address: marketAddress,
      question: question as string,
      creator,
      lpToken,
      isGraduated,
      isSettled: isSettled as boolean,
      isFinalized: isFinalized as boolean,
      isDismissed,
      winningOutcome,
      createdAt,
      bBase,
      bCurrent,
      creatorDeposit,
      stage,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch all markets with full details.
 */
export async function getAllMarkets(
  client: PublicClient,
  launchpadEngine: Address
): Promise<SdkMarket[]> {
  const addresses = await getMarketAddresses(client, launchpadEngine);
  const results = await Promise.all(
    addresses.map(addr => getMarketDetails(client, launchpadEngine, addr))
  );
  return results.filter((m): m is SdkMarket => m !== null);
}
