import type { PublicClient, Address } from 'viem';
import { OrderEngineABI } from '../abis/OrderEngine.js';

export interface PortfolioBalances {
  yesShares: bigint;
  noShares: bigint;
}

export async function getPortfolioBalances(
  client: PublicClient,
  orderEngine: Address,
  userAddress: Address,
  marketAddress: Address,
): Promise<PortfolioBalances> {
  const result = (await client.readContract({
    address: orderEngine,
    abi: OrderEngineABI,
    functionName: 'getPosition',
    args: [marketAddress, userAddress],
  })) as readonly [bigint, bigint];

  return { yesShares: result[0], noShares: result[1] };
}
