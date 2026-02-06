import { useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { getPublicClient } from '../lib/client';
import { getDeployment, ABIS } from '@sooth/sdk-core';
import type { Address } from 'viem';
import { MONAD_TESTNET_CHAIN_ID } from '../lib/config';
import { useMarkets, type Market } from './useMarkets';

const ERC20_BALANCE_ABI = [{ 
  name: 'balanceOf', 
  type: 'function', 
  stateMutability: 'view', 
  inputs: [{ name: 'account', type: 'address' }], 
  outputs: [{ name: '', type: 'uint256' }] 
}] as const;

export interface Position {
  market: Market;
  yesShares: bigint;
  noShares: bigint;
  totalShares: bigint;
  valueUsd: number;
  lpBalance: bigint;
}

async function fetchPositions(
  markets: Market[],
  userAddress: Address
): Promise<Position[]> {
  const client = getPublicClient(MONAD_TESTNET_CHAIN_ID);
  const deployment = getDeployment(MONAD_TESTNET_CHAIN_ID);

  if (!deployment) return [];

  const ammEngine = deployment.contracts.AMMEngine as Address;

  const positions: Position[] = [];

  for (const market of markets) {
    // Query all stages - AMM positions persist through graduation and settlement
    // Dismissed markets have no positions to show
    if (market.stage === 'dismissed') continue;

     try {
       const result = await client.readContract({
         address: ammEngine,
         abi: ABIS.AMMEngine,
         functionName: 'getPosition',
         args: [market.address, userAddress],
       });

       const [yesShares, noShares] = result as readonly [bigint, bigint];

       let lpBalance = 0n;
       if (market.lpToken && market.lpToken !== '0x0000000000000000000000000000000000000000') {
         try {
           lpBalance = await client.readContract({
             address: market.lpToken,
             abi: ERC20_BALANCE_ABI,
             functionName: 'balanceOf',
             args: [userAddress],
           }) as bigint;
         } catch {}
       }

       if (yesShares > 0n || noShares > 0n || lpBalance > 0n) {
         const yesValue = Number(yesShares) / 1e18 * (market.yesProbability ?? 0.5);
         const noValue = Number(noShares) / 1e18 * (1 - (market.yesProbability ?? 0.5));

         positions.push({
           market,
           yesShares,
           noShares,
           totalShares: yesShares + noShares,
           valueUsd: yesValue + noValue,
           lpBalance,
         });
       }
     } catch {
       continue;
     }
  }

  return positions;
}

export function usePositions() {
  const { address } = useAccount();
  const { data: markets } = useMarkets();

  return useQuery({
    queryKey: ['positions', MONAD_TESTNET_CHAIN_ID, address, markets?.map((m) => m.address)],
    queryFn: () => fetchPositions(markets ?? [], address as Address),
    enabled: !!address && !!markets && markets.length > 0,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
