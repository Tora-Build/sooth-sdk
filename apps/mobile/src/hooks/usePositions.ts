import { useQuery } from '@tanstack/react-query';
import { useAccount } from '@reown/appkit-react-native';
import { getPublicClient } from '../lib/client';
import { getDeployment, ABIS } from '@sooth/sdk-core';
import { formatUnits } from 'viem';
import type { Address } from 'viem';
import { useMarkets } from './useMarkets';

export interface Position {
  marketAddress: Address;
  marketName: string;
  stage: 'bonding' | 'live' | 'settled' | 'finalized' | 'dismissed';
  type: 'amm' | 'tickbook' | 'lp';
  yesShares: bigint;
  noShares: bigint;
  lpBalance?: bigint;
  valueUsd: number;
  yesProbability?: number;
  winningOutcome?: number | null;
}

const BASE_SEPOLIA_CHAIN_ID = 84532;
const CHUNK_SIZE = 5;

async function readContractSafe<T>(
  client: ReturnType<typeof getPublicClient>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: any
): Promise<T | null> {
  try {
    return (await client.readContract(config)) as T;
  } catch (error) {
    console.warn(`[readContractSafe] Error:`, error);
    return null;
  }
}

function calculatePositionValue(
  yesShares: bigint,
  noShares: bigint,
  yesProbability?: number,
  winningOutcome?: number | null
): number {
  const yesSharesNum = Number(formatUnits(yesShares, 18));
  const noSharesNum = Number(formatUnits(noShares, 18));

  if (winningOutcome !== undefined && winningOutcome !== null) {
    if (winningOutcome === 1) {
      return yesSharesNum * 1.0 + noSharesNum * 0.0;
    } else if (winningOutcome === 0) {
      return yesSharesNum * 0.0 + noSharesNum * 1.0;
    } else if (winningOutcome === 2) {
      return yesSharesNum * 0.5 + noSharesNum * 0.5;
    }
  }

  const yesPrice = yesProbability ?? 0.5;
  const noPrice = 1 - yesPrice;
  return yesSharesNum * yesPrice + noSharesNum * noPrice;
}

export function usePositions() {
  const { address } = useAccount();
  const { data: markets = [] } = useMarkets();

  const userAddress = address as Address | undefined;

  return useQuery({
    queryKey: ['positions', userAddress, BASE_SEPOLIA_CHAIN_ID],
    queryFn: async () => {
      if (!userAddress) return [];

      const client = getPublicClient();
      const deployment = getDeployment(BASE_SEPOLIA_CHAIN_ID);

      if (!deployment) {
        throw new Error(`No deployment found for chain ${BASE_SEPOLIA_CHAIN_ID}`);
      }

      const positions: Position[] = [];

      // Process markets in chunks
      for (let i = 0; i < markets.length; i += CHUNK_SIZE) {
        const chunk = markets.slice(i, i + CHUNK_SIZE);

        const chunkResults = await Promise.all(
          chunk.map(async (market) => {
            const chunkPositions: Position[] = [];

            try {
              // 1. Fetch AMM position
              const ammPosition = await readContractSafe<readonly [bigint, bigint]>(client, {
                address: deployment.contracts.AMMEngine as Address,
                abi: ABIS.AMMEngine,
                functionName: 'getPosition',
                args: [market.address, userAddress],
              });

              if (ammPosition && (ammPosition[0] > 0n || ammPosition[1] > 0n)) {
                const valueUsd = calculatePositionValue(
                  ammPosition[0],
                  ammPosition[1],
                  market.yesProbability,
                  market.winningOutcome
                );

                chunkPositions.push({
                  marketAddress: market.address,
                  marketName: market.question,
                  stage: market.stage,
                  type: 'amm',
                  yesShares: ammPosition[0],
                  noShares: ammPosition[1],
                  valueUsd,
                  yesProbability: market.yesProbability,
                  winningOutcome: market.winningOutcome,
                });
              }

              // 2. Fetch TickBook vault position (internal shares)
              const vaultData = await readContractSafe<
                readonly [bigint, bigint, bigint, bigint, bigint, bigint]
              >(client, {
                address: deployment.contracts.TickBookVault as Address,
                abi: ABIS.TickBookVault,
                functionName: 'getUserState',
                args: [market.address, userAddress],
              });

              if (vaultData) {
                const [yesInternal, noInternal] = vaultData;
                if (yesInternal > 0n || noInternal > 0n) {
                  const valueUsd = calculatePositionValue(
                    yesInternal,
                    noInternal,
                    market.yesProbability,
                    market.winningOutcome
                  );

                  chunkPositions.push({
                    marketAddress: market.address,
                    marketName: market.question,
                    stage: market.stage,
                    type: 'tickbook',
                    yesShares: yesInternal,
                    noShares: noInternal,
                    valueUsd,
                    yesProbability: market.yesProbability,
                    winningOutcome: market.winningOutcome,
                  });
                }
              }

              // 3. Fetch LP balance
              const lpToken = await readContractSafe<Address>(client, {
                address: deployment.contracts.LaunchpadEngine as Address,
                abi: ABIS.LaunchpadEngine,
                functionName: 'markets',
                args: [market.address],
              }).then((result) => {
                if (result && Array.isArray(result) && result.length > 1) {
                  return result[1] as Address;
                }
                return null;
              });

              if (lpToken) {
                const lpBalance = await readContractSafe<bigint>(client, {
                  address: lpToken,
                  abi: [
                    {
                      name: 'balanceOf',
                      type: 'function',
                      inputs: [{ name: 'account', type: 'address' }],
                      outputs: [{ name: '', type: 'uint256' }],
                      stateMutability: 'view',
                    },
                  ],
                  functionName: 'balanceOf',
                  args: [userAddress],
                });

                if (lpBalance && lpBalance > 0n) {
                  // Fetch LP supply and floor value for valuation
                  const lpState = await readContractSafe<
                    readonly [bigint, bigint, bigint, bigint, bigint, bigint]
                  >(client, {
                    address: deployment.contracts.LaunchpadEngine as Address,
                    abi: ABIS.LaunchpadEngine,
                    functionName: 'markets',
                    args: [market.address],
                  });

                  let valueUsd = 0;
                  if (lpState && lpState.length >= 5) {
                    const floorValue = lpState[5];
                    if (floorValue && floorValue > 0n) {
                      const userLpNum = Number(formatUnits(lpBalance, 18));
                      const floorRate = Number(formatUnits(floorValue, 6));
                      valueUsd = userLpNum * floorRate;
                    }
                  }

                  chunkPositions.push({
                    marketAddress: market.address,
                    marketName: market.question,
                    stage: market.stage,
                    type: 'lp',
                    yesShares: 0n,
                    noShares: 0n,
                    lpBalance,
                    valueUsd,
                    yesProbability: market.yesProbability,
                    winningOutcome: market.winningOutcome,
                  });
                }
              }
            } catch (error) {
              console.warn(`[usePositions] Failed to fetch positions for market ${market.address}:`, error);
            }

            return chunkPositions;
          })
        );

        positions.push(...chunkResults.flat());

        // Small delay between chunks
        if (i + CHUNK_SIZE < markets.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      return positions;
    },
    enabled: !!userAddress && markets.length > 0,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
