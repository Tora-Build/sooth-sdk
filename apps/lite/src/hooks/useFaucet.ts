import { useMutation } from '@tanstack/react-query';
import { useAccount, useWalletClient } from 'wagmi';
import { getDeployment } from '@sooth/sdk-core';
import { parseUnits } from 'viem';
import { MONAD_TESTNET_CHAIN_ID } from '../lib/config';
import { getPublicClient } from '../lib/client';

type Address = `0x${string}`;

const MOCK_USDC_ABI = [
  {
    name: 'mint',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
] as const;

export function useFaucet() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const deployment = getDeployment(MONAD_TESTNET_CHAIN_ID);
  const mockUsdcAddress = deployment?.contracts.MockUSDC as Address | undefined;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!address || !walletClient || !mockUsdcAddress) {
        throw new Error('Wallet not connected');
      }

      const client = getPublicClient(MONAD_TESTNET_CHAIN_ID);
      
      const decimals = await client.readContract({
        address: mockUsdcAddress,
        abi: MOCK_USDC_ABI,
        functionName: 'decimals',
      });

      const mintAmount = parseUnits('1000', decimals);

      const hash = await walletClient.writeContract({
        address: mockUsdcAddress,
        abi: MOCK_USDC_ABI,
        functionName: 'mint',
        args: [address, mintAmount],
      });

      await client.waitForTransactionReceipt({ hash });

      return hash;
    },
  });

  return {
    mint: mutation.mutate,
    mintAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
  };
}
