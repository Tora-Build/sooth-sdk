/**
 * Markets — read/write operations on LaunchpadEngine + AMMEngine
 */

import { parseUnits } from 'viem';
import type { SoothClient } from './client';
import type { MarketInfo, Position, TradeParams } from './types';

const LaunchpadAbi = [
  {
    name: 'getMarkets',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'address[]' }],
    stateMutability: 'view',
  },
  {
    name: 'getMarketCount',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'markets',
    type: 'function',
    inputs: [{ type: 'address', name: 'market' }],
    outputs: [
      { type: 'address', name: 'creator' },
      { type: 'address', name: 'lpToken' },
      { type: 'uint256', name: 'bBase' },
      { type: 'uint256', name: 'creatorDeposit' },
      { type: 'uint64', name: 'graduatedAt' },
    ],
    stateMutability: 'view',
  },
  {
    name: 'isGraduated',
    type: 'function',
    inputs: [{ type: 'address', name: 'market' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
  {
    name: 'createMarket',
    type: 'function',
    inputs: [
      { type: 'string', name: 'question' },
      { type: 'uint64', name: 'startTime' },
      { type: 'uint64', name: 'deadline' },
      { type: 'address', name: 'adjudicator' },
      { type: 'uint256', name: 'bBase' },
      { type: 'uint256', name: 'initialProbabilityWad' },
      { type: 'bytes', name: 'adjudicatorConfig' },
    ],
    outputs: [{ type: 'address' }, { type: 'address' }],
    stateMutability: 'nonpayable',
  },
] as const;

const AmmAbi = [
  {
    name: 'tradePositions',
    type: 'function',
    inputs: [
      { type: 'address', name: 'market' },
      { type: 'uint8', name: 'outcome' },
      { type: 'int256', name: 'deltaShares' },
      { type: 'uint256', name: 'maxCostOrMinProceeds' },
    ],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    name: 'getPosition',
    type: 'function',
    inputs: [
      { type: 'address', name: 'market' },
      { type: 'address', name: 'user' },
    ],
    outputs: [{ type: 'uint256' }, { type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'getBalances',
    type: 'function',
    inputs: [{ type: 'address', name: 'user' }],
    outputs: [{ type: 'uint256', name: 'available' }, { type: 'uint256', name: 'locked' }],
    stateMutability: 'view',
  },
] as const;

export class Markets {
  private client: SoothClient;

  constructor(client: SoothClient) {
    this.client = client;
  }

  /** List all market addresses */
  async list(): Promise<`0x${string}`[]> {
    const result = await this.client.publicClient.readContract({
      address: this.client.contracts.launchpadEngine,
      abi: LaunchpadAbi,
      functionName: 'getMarkets',
    });
    return result as `0x${string}`[];
  }

  /** Get market count */
  async count(): Promise<number> {
    const result = await this.client.publicClient.readContract({
      address: this.client.contracts.launchpadEngine,
      abi: LaunchpadAbi,
      functionName: 'getMarketCount',
    });
    return Number(result);
  }

  /** Get market info */
  async getInfo(market: `0x${string}`): Promise<MarketInfo> {
    const [marketsResult, isGraduated] = await Promise.all([
      this.client.publicClient.readContract({
        address: this.client.contracts.launchpadEngine,
        abi: LaunchpadAbi,
        functionName: 'markets',
        args: [market],
      }) as Promise<[`0x${string}`, `0x${string}`, bigint, bigint, bigint]>,
      this.client.publicClient.readContract({
        address: this.client.contracts.launchpadEngine,
        abi: LaunchpadAbi,
        functionName: 'isGraduated',
        args: [market],
      }) as Promise<boolean>,
    ]);
    return {
      address: market,
      creator: marketsResult[0],
      bBase: marketsResult[2],
      bCurrent: 0n, // No longer in struct
      feesAccrued: 0n, // No longer in struct
      totalLPSupply: 0n, // No longer in struct
      isGraduated,
      createdAt: 0n, // No longer in struct
    };
  }

  /** Get AMM position for a user */
  async getPosition(
    market: `0x${string}`,
    user: `0x${string}`,
  ): Promise<Position> {
    const result = (await this.client.publicClient.readContract({
      address: this.client.contracts.ammEngine,
      abi: AmmAbi,
      functionName: 'getPosition',
      args: [market, user],
    })) as [bigint, bigint];
    return { yesShares: result[0], noShares: result[1] };
  }

  /** Buy or sell shares. outcome: 'yes'=1, 'no'=0. Positive deltaShares = buy, negative = sell. */
  async trade(
    market: `0x${string}`,
    params: TradeParams,
  ): Promise<`0x${string}`> {
    const outcome = params.outcome === 'yes' ? 1 : 0;
    const shares = parseUnits(params.shares, 18);
    const maxCost = parseUnits(params.maxCost, 18);

    return this.client.writeContract({
      address: this.client.contracts.ammEngine,
      abi: AmmAbi,
      functionName: 'tradePositions',
      args: [market, outcome, shares, maxCost],
    });
  }

  /** Create a new market */
  async create(params: {
    question: string;
    initialLiquidity: string;
    adjudicator?: `0x${string}`;
    deadline?: bigint;
  }): Promise<`0x${string}`> {
    const bBase = parseUnits(params.initialLiquidity, 18);
    const adjudicator = params.adjudicator ?? (this.client.account as `0x${string}`);
    const deadline = params.deadline ?? 7258118399n; // year 2199

    return this.client.writeContract({
      address: this.client.contracts.launchpadEngine,
      abi: LaunchpadAbi,
      functionName: 'createMarket',
      args: [params.question, 0n, deadline, adjudicator, bBase, 500000000000000000n, '0x'],
    });
  }
}
