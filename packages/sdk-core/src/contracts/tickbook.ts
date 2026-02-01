import type { PublicClient, Address } from 'viem';
import { TickBookPoolManagerABI } from '../abis/TickBookPoolManager.js';

export interface TickBookMarketState {
  tick: number;
  liqNo: bigint;
  liqYes: bigint;
  prob: bigint;
}

/**
 * Read the current market state from TickBookPoolManager.
 */
export async function getTickBookMarketState(
  client: PublicClient,
  tickBookPoolManager: Address,
  marketKey: `0x${string}`
): Promise<TickBookMarketState> {
  const result = await client.readContract({
    address: tickBookPoolManager,
    abi: TickBookPoolManagerABI,
    functionName: 'getMarketState',
    args: [marketKey],
  }) as readonly [number, bigint, bigint, bigint];

  return {
    tick: Number(result[0]),
    liqNo: result[1],
    liqYes: result[2],
    prob: result[3],
  };
}
