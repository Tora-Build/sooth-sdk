import { useQuery } from '@tanstack/react-query';
import { getPublicClient } from '../lib/client';
import { getDeployment } from '@sooth/sdk-core';
import { formatUnits } from 'viem';
import { MONAD_TESTNET_CHAIN_ID } from '../lib/config';

type Address = `0x${string}`;

const DEFAULT_USDC_DECIMALS = 6;

const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
] as const;

export interface USDCBalanceData {
  balance: bigint;
  balanceFormatted: string;
  decimals: number;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useUSDCBalance(userAddress: Address | undefined): USDCBalanceData {
  const deployment = getDeployment(MONAD_TESTNET_CHAIN_ID);
  const mockUsdcAddress = deployment?.contracts.MockUSDC as Address | undefined;

  const { data: decimalsData } = useQuery({
    queryKey: ['usdc-decimals', mockUsdcAddress, MONAD_TESTNET_CHAIN_ID],
    queryFn: async () => {
      if (!mockUsdcAddress) return DEFAULT_USDC_DECIMALS;
      const client = getPublicClient(MONAD_TESTNET_CHAIN_ID);
      const decimals = await client.readContract({
        address: mockUsdcAddress,
        abi: ERC20_ABI,
        functionName: 'decimals',
      });
      return Number(decimals ?? DEFAULT_USDC_DECIMALS);
    },
    enabled: !!mockUsdcAddress,
    staleTime: 60_000,
  });

  const decimals = decimalsData ?? DEFAULT_USDC_DECIMALS;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['usdc-balance', userAddress, MONAD_TESTNET_CHAIN_ID],
    queryFn: async () => {
      if (!userAddress || !mockUsdcAddress) return 0n;
      const client = getPublicClient(MONAD_TESTNET_CHAIN_ID);
      const balance = await client.readContract({
        address: mockUsdcAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [userAddress],
      });
      return balance as bigint;
    },
    enabled: !!userAddress && !!mockUsdcAddress,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  const balance = data ?? 0n;
  const balanceFormatted = formatUnits(balance, decimals);
  const displayBalance = Number(balanceFormatted).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return {
    balance,
    balanceFormatted: displayBalance,
    decimals,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}
