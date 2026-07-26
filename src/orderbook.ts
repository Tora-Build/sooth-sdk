/**
 * Orderbook — SoothBook read/write operations.
 * Uses the canonical, unit-tested SoothBookABI from ./core/abis (no inline
 * redeclaration). The prior inline ABI had drifted from the deployed v0.2.1
 * contract — buyYes/buyNo's 5th arg is matchLimit (uint32), markets() was
 * removed, and the keyed price getter is getImpliedPriceByKey.
 */

import { keccak256, encodePacked, parseUnits } from 'viem';
import type { SoothClient } from './client.js';
import { SoothBookABI } from './core/abis/index.js';

/** Default max maker orders a taker will cross in one call. */
const DEFAULT_MATCH_LIMIT = 100;

export class Orderbook {
  private client: SoothClient;

  constructor(client: SoothClient) {
    this.client = client;
  }

  /** Compute market key from address: keccak256(encodePacked(address)). */
  marketKey(market: `0x${string}`): `0x${string}` {
    return keccak256(encodePacked(['address'], [market]));
  }

  /** Whether a market key is registered on SoothBook. Replaces the removed
   *  `markets(bytes32)` struct getter (v0.2.1 no longer exposes it). */
  async isRegistered(marketKey: `0x${string}`): Promise<boolean> {
    return (await this.client.publicClient.readContract({
      address: this.client.contracts.soothBook,
      abi: SoothBookABI,
      functionName: 'registeredMarkets',
      args: [marketKey],
    })) as boolean;
  }

  /** Best resting tick for a side (0=YES, 1=NO). */
  async getBestTick(marketKey: `0x${string}`, side: 'yes' | 'no'): Promise<number> {
    const sideNum = side === 'yes' ? 0 : 1;
    const result = await this.client.publicClient.readContract({
      address: this.client.contracts.soothBook,
      abi: SoothBookABI,
      functionName: 'getBestTick',
      args: [marketKey, sideNum],
    });
    return Number(result);
  }

  /** Implied YES/NO price for a market key (bytes32). */
  async getImpliedPrice(marketKey: `0x${string}`): Promise<{ yesPrice: bigint; noPrice: bigint }> {
    const result = (await this.client.publicClient.readContract({
      address: this.client.contracts.soothBook,
      abi: SoothBookABI,
      functionName: 'getImpliedPriceByKey',
      args: [marketKey],
    })) as readonly [bigint, bigint];
    return { yesPrice: result[0], noPrice: result[1] };
  }

  /** Implied YES/NO price for a market address. */
  async getImpliedPriceByMarket(
    market: `0x${string}`,
  ): Promise<{ yesPrice: bigint; noPrice: bigint }> {
    const result = (await this.client.publicClient.readContract({
      address: this.client.contracts.soothBook,
      abi: SoothBookABI,
      functionName: 'getImpliedPrice',
      args: [market],
    })) as readonly [bigint, bigint];
    return { yesPrice: result[0], noPrice: result[1] };
  }

  /** User YES/NO balances held in SoothBook. */
  async getBalance(
    marketKey: `0x${string}`,
    user: `0x${string}`,
  ): Promise<{ yes: bigint; no: bigint }> {
    const result = (await this.client.publicClient.readContract({
      address: this.client.contracts.soothBook,
      abi: SoothBookABI,
      functionName: 'getBalance',
      args: [marketKey, user],
    })) as readonly [bigint, bigint];
    return { yes: result[0], no: result[1] };
  }

  /** Resting depth at a specific tick. */
  async getOrdersAtTick(
    marketKey: `0x${string}`,
    side: 'yes' | 'no',
    tick: number,
  ): Promise<{ totalAmount: bigint; orderCount: bigint }> {
    const sideNum = side === 'yes' ? 0 : 1;
    const result = (await this.client.publicClient.readContract({
      address: this.client.contracts.soothBook,
      abi: SoothBookABI,
      functionName: 'getOrdersAtTick',
      args: [marketKey, sideNum, tick],
    })) as readonly [bigint, bigint];
    return { totalAmount: result[0], orderCount: result[1] };
  }

  /** Place a YES buy/limit order. `matchLimit` caps maker orders crossed. */
  async buyYes(
    marketKey: `0x${string}`,
    params: { tick: number; amount: string; escrow?: boolean; matchLimit?: number },
  ): Promise<`0x${string}`> {
    const amount = parseUnits(params.amount, 18);
    return this.client.writeContract({
      address: this.client.contracts.soothBook,
      abi: SoothBookABI,
      functionName: 'buyYes',
      args: [
        marketKey,
        params.tick,
        amount,
        params.escrow ?? false,
        params.matchLimit ?? DEFAULT_MATCH_LIMIT,
      ],
    });
  }

  /** Place a NO buy/limit order. `matchLimit` caps maker orders crossed. */
  async buyNo(
    marketKey: `0x${string}`,
    params: { tick: number; amount: string; escrow?: boolean; matchLimit?: number },
  ): Promise<`0x${string}`> {
    const amount = parseUnits(params.amount, 18);
    return this.client.writeContract({
      address: this.client.contracts.soothBook,
      abi: SoothBookABI,
      functionName: 'buyNo',
      args: [
        marketKey,
        params.tick,
        amount,
        params.escrow ?? false,
        params.matchLimit ?? DEFAULT_MATCH_LIMIT,
      ],
    });
  }

  /** Cancel a resting order by (side, tick). */
  async cancel(marketKey: `0x${string}`, side: 'yes' | 'no', tick: number): Promise<`0x${string}`> {
    const sideNum = side === 'yes' ? 0 : 1;
    return this.client.writeContract({
      address: this.client.contracts.soothBook,
      abi: SoothBookABI,
      functionName: 'cancel',
      args: [marketKey, sideNum, tick],
    });
  }

  /** Cancel a resting order by its order id. */
  async cancelById(orderId: bigint): Promise<`0x${string}`> {
    return this.client.writeContract({
      address: this.client.contracts.soothBook,
      abi: SoothBookABI,
      functionName: 'cancelById',
      args: [orderId],
    });
  }
}
