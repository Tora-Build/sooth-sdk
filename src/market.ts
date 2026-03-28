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
      { type: 'uint256', name: 'bCurrent' },
      { type: 'uint256', name: 'creatorDeposit' },
      { type: 'uint256', name: 'feesAccrued' },
      { type: 'uint256', name: 'totalLPSupply' },
      { type: 'uint256', name: 'lpYieldPool' },
      { type: 'bool', name: 'isGraduated' },
      { type: 'uint64', name: 'createdAt' },
      { type: 'uint64', name: 'graduatedAt' },
    ],
    stateMutability: 'view',
  },
  {
    name: 'getGraduationProgress',
    type: 'function',
    inputs: [{ type: 'address', name: 'market' }],
    outputs: [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'tradePositions',
    type: 'function',
    inputs: [
      { type: 'address', name: 'market' },
      { type: 'uint8', name: 'outcome' },
      { type: 'int256', name: 'deltaShares' },
      { type: 'uint256', name: 'maxCost' },
    ],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    name: 'createMarket',
    type: 'function',
    inputs: [
      { type: 'string', name: 'question' },
      { type: 'uint64', name: 'startTime' },
      { type: 'uint64', name: 'deadline' },
      { type: 'address', name: 'adjudicator' },
      { type: 'address', name: 'guardian' },
      { type: 'uint256', name: 'initialLiquidity' },
      { type: 'uint256', name: 'adjudicatorAgentId' },
      { type: 'uint256', name: 'adjudicatorMinValidators' },
    ],
    outputs: [{ type: 'address' }],
    stateMutability: 'nonpayable',
  },
] as const;

const AmmAbi = [
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
    outputs: [{ type: 'uint256' }, { type: 'uint256' }],
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
    const result = (await this.client.publicClient.readContract({
      address: this.client.contracts.launchpadEngine,
      abi: LaunchpadAbi,
      functionName: 'markets',
      args: [market],
    })) as [
      `0x${string}`,
      `0x${string}`,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      boolean,
      bigint,
      bigint,
    ];
    return {
      address: market,
      creator: result[0],
      bBase: result[2],
      bCurrent: result[3],
      feesAccrued: result[5],
      totalLPSupply: result[6],
      isGraduated: result[8],
      createdAt: result[9],
    };
  }

  /** Get graduation progress: [feesAccrued, threshold, progressBps] */
  async getGraduationProgress(
    market: `0x${string}`,
  ): Promise<{ feesAccrued: bigint; threshold: bigint; progressBps: bigint }> {
    const result = (await this.client.publicClient.readContract({
      address: this.client.contracts.launchpadEngine,
      abi: LaunchpadAbi,
      functionName: 'getGraduationProgress',
      args: [market],
    })) as [bigint, bigint, bigint];
    return {
      feesAccrued: result[0],
      threshold: result[1],
      progressBps: result[2],
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
      address: this.client.contracts.launchpadEngine,
      abi: LaunchpadAbi,
      functionName: 'tradePositions',
      args: [market, outcome, shares, maxCost],
    });
  }

  /** Create a new market */
  async create(params: {
    question: string;
    initialLiquidity: string;
    adjudicator?: `0x${string}`;
    guardian?: `0x${string}`;
    deadline?: bigint;
  }): Promise<`0x${string}`> {
    const liquidity = parseUnits(params.initialLiquidity, 18);
    const adjudicator = params.adjudicator ?? (this.client.account as `0x${string}`);
    const guardian = params.guardian ?? this.client.contracts.adjudicatorRegistry;
    const deadline = params.deadline ?? 7258118399n; // year 2199

    return this.client.writeContract({
      address: this.client.contracts.launchpadEngine,
      abi: LaunchpadAbi,
      functionName: 'createMarket',
      args: [params.question, 0n, deadline, adjudicator, guardian, liquidity, 0n, 0n],
    });
  }
}
