/**
 * Orderbook — SoothBook read/write operations
 */

import { keccak256, encodePacked, parseUnits } from 'viem';
import type { SoothClient } from './client';

const SoothBookAbi = [
  {
    name: 'buyYes',
    type: 'function',
    inputs: [
      { type: 'bytes32', name: 'marketKey' },
      { type: 'uint16', name: 'tick' },
      { type: 'uint128', name: 'amount' },
      { type: 'bool', name: 'escrow' },
      { type: 'uint256', name: 'maxCost' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'buyNo',
    type: 'function',
    inputs: [
      { type: 'bytes32', name: 'marketKey' },
      { type: 'uint16', name: 'tick' },
      { type: 'uint128', name: 'amount' },
      { type: 'bool', name: 'escrow' },
      { type: 'uint256', name: 'maxCost' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'cancel',
    type: 'function',
    inputs: [
      { type: 'bytes32', name: 'marketKey' },
      { type: 'uint8', name: 'side' },
      { type: 'uint16', name: 'tick' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'getBalance',
    type: 'function',
    inputs: [
      { type: 'bytes32', name: 'marketKey' },
      { type: 'address', name: 'user' },
    ],
    outputs: [
      { type: 'uint256', name: 'yes' },
      { type: 'uint256', name: 'no' },
    ],
    stateMutability: 'view',
  },
  {
    name: 'getBestTick',
    type: 'function',
    inputs: [
      { type: 'bytes32', name: 'marketKey' },
      { type: 'uint8', name: 'side' },
    ],
    outputs: [{ type: 'uint16' }],
    stateMutability: 'view',
  },
  {
    name: 'getOrdersAtTick',
    type: 'function',
    inputs: [
      { type: 'bytes32', name: 'marketKey' },
      { type: 'uint8', name: 'side' },
      { type: 'uint16', name: 'tick' },
    ],
    outputs: [
      { type: 'uint256', name: 'totalAmount' },
      { type: 'uint256', name: 'orderCount' },
    ],
    stateMutability: 'view',
  },
  {
    name: 'getImpliedPrice',
    type: 'function',
    inputs: [{ type: 'bytes32', name: 'marketKey' }],
    outputs: [
      { type: 'uint256', name: 'yesPrice' },
      { type: 'uint256', name: 'noPrice' },
    ],
    stateMutability: 'view',
  },
  {
    name: 'markets',
    type: 'function',
    inputs: [{ type: 'bytes32' }],
    outputs: [
      { type: 'address', name: 'collateral' },
      { type: 'address', name: 'yesToken' },
      { type: 'address', name: 'noToken' },
      { type: 'bool', name: 'active' },
      { type: 'bool', name: 'finalized' },
      { type: 'uint8', name: 'outcome' },
    ],
    stateMutability: 'view',
  },
] as const;

export class Orderbook {
  private client: SoothClient;

  constructor(client: SoothClient) {
    this.client = client;
  }

  /** Compute market key from address: keccak256(encodePacked(address)) */
  marketKey(market: `0x${string}`): `0x${string}` {
    return keccak256(encodePacked(['address'], [market]));
  }

  /** Get SoothBook market state */
  async getMarket(marketKey: `0x${string}`) {
    const result = (await this.client.publicClient.readContract({
      address: this.client.contracts.soothBook,
      abi: SoothBookAbi,
      functionName: 'markets',
      args: [marketKey],
    })) as [`0x${string}`, `0x${string}`, `0x${string}`, boolean, boolean, number];
    return {
      collateral: result[0],
      yesToken: result[1],
      noToken: result[2],
      active: result[3],
      finalized: result[4],
      outcome: result[5],
    };
  }

  /** Get best tick for a side (0=YES, 1=NO) */
  async getBestTick(
    marketKey: `0x${string}`,
    side: 'yes' | 'no',
  ): Promise<number> {
    const sideNum = side === 'yes' ? 0 : 1;
    const result = await this.client.publicClient.readContract({
      address: this.client.contracts.soothBook,
      abi: SoothBookAbi,
      functionName: 'getBestTick',
      args: [marketKey, sideNum],
    });
    return Number(result);
  }

  /** Get implied price */
  async getImpliedPrice(
    marketKey: `0x${string}`,
  ): Promise<{ yesPrice: bigint; noPrice: bigint }> {
    const result = (await this.client.publicClient.readContract({
      address: this.client.contracts.soothBook,
      abi: SoothBookAbi,
      functionName: 'getImpliedPrice',
      args: [marketKey],
    })) as [bigint, bigint];
    return { yesPrice: result[0], noPrice: result[1] };
  }

  /** Get user balances in SoothBook */
  async getBalance(
    marketKey: `0x${string}`,
    user: `0x${string}`,
  ): Promise<{ yes: bigint; no: bigint }> {
    const result = (await this.client.publicClient.readContract({
      address: this.client.contracts.soothBook,
      abi: SoothBookAbi,
      functionName: 'getBalance',
      args: [marketKey, user],
    })) as [bigint, bigint];
    return { yes: result[0], no: result[1] };
  }

  /** Get orders at a specific tick */
  async getOrdersAtTick(
    marketKey: `0x${string}`,
    side: 'yes' | 'no',
    tick: number,
  ): Promise<{ totalAmount: bigint; orderCount: bigint }> {
    const sideNum = side === 'yes' ? 0 : 1;
    const result = (await this.client.publicClient.readContract({
      address: this.client.contracts.soothBook,
      abi: SoothBookAbi,
      functionName: 'getOrdersAtTick',
      args: [marketKey, sideNum, tick],
    })) as [bigint, bigint];
    return { totalAmount: result[0], orderCount: result[1] };
  }

  /** Place a YES buy order */
  async buyYes(
    marketKey: `0x${string}`,
    params: { tick: number; amount: string; escrow?: boolean; maxCost?: string },
  ): Promise<`0x${string}`> {
    const amount = parseUnits(params.amount, 18);
    const maxCost = params.maxCost
      ? parseUnits(params.maxCost, 18)
      : amount;
    return this.client.writeContract({
      address: this.client.contracts.soothBook,
      abi: SoothBookAbi,
      functionName: 'buyYes',
      args: [marketKey, params.tick, amount, params.escrow ?? false, maxCost],
    });
  }

  /** Place a NO buy order */
  async buyNo(
    marketKey: `0x${string}`,
    params: { tick: number; amount: string; escrow?: boolean; maxCost?: string },
  ): Promise<`0x${string}`> {
    const amount = parseUnits(params.amount, 18);
    const maxCost = params.maxCost
      ? parseUnits(params.maxCost, 18)
      : amount;
    return this.client.writeContract({
      address: this.client.contracts.soothBook,
      abi: SoothBookAbi,
      functionName: 'buyNo',
      args: [marketKey, params.tick, amount, params.escrow ?? false, maxCost],
    });
  }

  /** Cancel an order */
  async cancel(
    marketKey: `0x${string}`,
    side: 'yes' | 'no',
    tick: number,
  ): Promise<`0x${string}`> {
    const sideNum = side === 'yes' ? 0 : 1;
    return this.client.writeContract({
      address: this.client.contracts.soothBook,
      abi: SoothBookAbi,
      functionName: 'cancel',
      args: [marketKey, sideNum, tick],
    });
  }
}
