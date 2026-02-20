import { useQuery } from '@tanstack/react-query';
import { formatUnits, type Address } from 'viem';
import {
  ACTION_HUB_ADDRESS,
  ERC20_ABI,
  WGHO_ADDRESS,
  lensPublicClient,
} from '../lib/soothAction';

export interface WGHOBalanceData {
  balance: bigint;
  allowance: bigint;
  balanceFormatted: string;
}

export function useWGHOBalance(
  user: Address | undefined,
  actionHub: Address = ACTION_HUB_ADDRESS,
) {
  return useQuery({
    queryKey: ['wgho-balance', user ?? null, actionHub],
    queryFn: async (): Promise<WGHOBalanceData> => {
      if (!user) {
        throw new Error('Missing user address');
      }

      const [balance, allowance] = await Promise.all([
        lensPublicClient.readContract({
          address: WGHO_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [user],
        }),
        lensPublicClient.readContract({
          address: WGHO_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [user, actionHub],
        }),
      ]);

      return {
        balance: balance as bigint,
        allowance: allowance as bigint,
        balanceFormatted: formatUnits(balance as bigint, 18),
      };
    },
    enabled: Boolean(user),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}
