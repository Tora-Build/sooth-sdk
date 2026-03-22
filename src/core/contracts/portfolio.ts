import type { PublicClient, Address } from 'viem';
import { CollateralizerABI } from '../abis/Collateralizer.js';

export interface PortfolioBalances {
  yesShares: bigint;
  noShares: bigint;
}

/**
 * Fetch a user's outcome token balances for a market from the Collateralizer.
 */
export async function getPortfolioBalances(
  client: PublicClient,
  collateralizer: Address,
  userAddress: Address,
  marketAddress: Address
): Promise<PortfolioBalances> {
  const result = await client.readContract({
    address: collateralizer,
    abi: CollateralizerABI,
    functionName: 'getBalances',
    args: [marketAddress, userAddress],
  }) as readonly [bigint, bigint];

  return { yesShares: result[0], noShares: result[1] };
}
