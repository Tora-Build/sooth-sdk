import { useReadContracts, useAccount } from 'wagmi';
import { V8_ABIS } from '../../config/abis';

type Address = `0x${string}`;

export function useTokenBalances(tokens: Address[]) {
  const { address } = useAccount();

  const { data, isLoading, refetch } = useReadContracts({
    contracts: tokens.map(token => ({
      address: token,
      abi: V8_ABIS.OutcomeToken, // Both OutcomeToken and ERC20 have balanceOf
      functionName: 'balanceOf',
      args: address ? [address] : undefined,
    })),
    query: {
      enabled: !!address && tokens.length > 0,
      refetchInterval: 15000,
    }
  });

  return {
    balances: data?.map(d => (d.result as bigint) ?? 0n) ?? tokens.map(() => 0n),
    isLoading,
    refetch
  };
}

