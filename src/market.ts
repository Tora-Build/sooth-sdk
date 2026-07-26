/**
 * Markets — read/write operations on LaunchpadEngine + AMMEngine.
 * Uses the canonical, unit-tested ABIs from ./core/abis (no inline redeclarations).
 */

import { parseUnits } from 'viem';
import type { SoothClient } from './client';
import type { MarketInfo, Position, TradeParams } from './types';
import { LaunchpadEngineABI, AMMEngineABI } from './core/abis';

const WAD = 1_000_000_000_000_000_000n; // 1e18

export class Markets {
  private client: SoothClient;

  constructor(client: SoothClient) {
    this.client = client;
  }

  /** List all market addresses */
  async list(): Promise<`0x${string}`[]> {
    const result = await this.client.publicClient.readContract({
      address: this.client.contracts.launchpadEngine,
      abi: LaunchpadEngineABI,
      functionName: 'getMarkets',
    });
    return result as `0x${string}`[];
  }

  /** Get market count */
  async count(): Promise<number> {
    const result = await this.client.publicClient.readContract({
      address: this.client.contracts.launchpadEngine,
      abi: LaunchpadEngineABI,
      functionName: 'getMarketCount',
    });
    return Number(result);
  }

  /** Get market info (creator, lpToken, bBase, creatorDeposit, graduation). */
  async getInfo(market: `0x${string}`): Promise<MarketInfo> {
    const [marketsResult, isGraduated] = await Promise.all([
      this.client.publicClient.readContract({
        address: this.client.contracts.launchpadEngine,
        abi: LaunchpadEngineABI,
        functionName: 'markets',
        args: [market],
      }) as Promise<readonly [`0x${string}`, `0x${string}`, bigint, bigint, bigint]>,
      this.client.publicClient.readContract({
        address: this.client.contracts.launchpadEngine,
        abi: LaunchpadEngineABI,
        functionName: 'isGraduated',
        args: [market],
      }) as Promise<boolean>,
    ]);
    return {
      address: market,
      creator: marketsResult[0],
      lpToken: marketsResult[1],
      bBase: marketsResult[2],
      creatorDeposit: marketsResult[3],
      graduatedAt: marketsResult[4],
      isGraduated,
    };
  }

  /** Get AMM position for a user */
  async getPosition(market: `0x${string}`, user: `0x${string}`): Promise<Position> {
    const result = (await this.client.publicClient.readContract({
      address: this.client.contracts.ammEngine,
      abi: AMMEngineABI,
      functionName: 'getPosition',
      args: [market, user],
    })) as readonly [bigint, bigint];
    return { yesShares: result[0], noShares: result[1] };
  }

  /**
   * Buy or sell shares of an outcome.
   *   outcome: 'yes' (1) | 'no' (0)
   *   side:    'buy' (default) increases the position, 'sell' decreases it
   * On a buy, `maxCost` bounds the spend; on a sell, `minProceeds` (default 0)
   * bounds the payout. The signed `deltaShares` carries the direction on-chain.
   */
  async trade(market: `0x${string}`, params: TradeParams): Promise<`0x${string}`> {
    const outcome = params.outcome === 'yes' ? 1 : 0;
    const side = params.side ?? 'buy';
    const magnitude = parseUnits(params.shares, 18);
    const deltaShares = side === 'sell' ? -magnitude : magnitude;

    let limit: bigint;
    if (side === 'buy') {
      if (params.maxCost === undefined) {
        throw new Error('trade({ side: "buy" }) requires maxCost');
      }
      limit = parseUnits(params.maxCost, 18);
    } else {
      limit = params.minProceeds !== undefined ? parseUnits(params.minProceeds, 18) : 0n;
    }

    return this.client.writeContract({
      address: this.client.contracts.ammEngine,
      abi: AMMEngineABI,
      functionName: 'tradePositions',
      args: [market, outcome, deltaShares, limit],
    });
  }

  /**
   * Create a new market.
   *
   * The adjudicator MUST be a deployed contract — v0.1.2+ `createMarket`
   * unconditionally calls `IAdjudicator(adjudicator).configureMarket()`, so an
   * EOA reverts. Defaults to the node registry's `adjudicators.default`; pass
   * `adjudicator` to override. Never falls back to the caller's own address.
   */
  async create(params: {
    question: string;
    initialLiquidity: string;
    adjudicator?: `0x${string}`;
    /** 0 < p < 1e18. Defaults to 0.5e18 (a 50/50 market). */
    initialProbabilityWad?: bigint;
    adjudicatorConfig?: `0x${string}`;
    startTime?: bigint;
    deadline?: bigint;
  }): Promise<`0x${string}`> {
    const bBase = parseUnits(params.initialLiquidity, 18);
    const adjudicator = params.adjudicator ?? this.client.node.adjudicators?.default;
    if (!adjudicator) {
      throw new Error(
        'No adjudicator available. Pass params.adjudicator (a deployed IAdjudicator ' +
          'contract), or use a node whose registry defines adjudicators.default. ' +
          'An EOA is rejected: createMarket calls IAdjudicator.configureMarket().',
      );
    }
    const initialProbabilityWad = params.initialProbabilityWad ?? WAD / 2n;
    if (initialProbabilityWad <= 0n || initialProbabilityWad >= WAD) {
      throw new Error('initialProbabilityWad must satisfy 0 < p < 1e18');
    }
    const deadline = params.deadline ?? 7258118399n; // year 2199 ("no expiry")
    const startTime = params.startTime ?? 0n;
    const adjudicatorConfig = params.adjudicatorConfig ?? '0x';

    return this.client.writeContract({
      address: this.client.contracts.launchpadEngine,
      abi: LaunchpadEngineABI,
      functionName: 'createMarket',
      args: [
        params.question,
        startTime,
        deadline,
        adjudicator,
        bBase,
        initialProbabilityWad,
        adjudicatorConfig,
      ],
    });
  }
}
