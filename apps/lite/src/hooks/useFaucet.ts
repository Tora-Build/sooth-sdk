import { useMutation } from '@tanstack/react-query';
import { useAccount, useWalletClient } from 'wagmi';
import { getDeployment } from '@sooth/sdk-core';
import { parseUnits } from 'viem';
import { MONAD_TESTNET_CHAIN_ID } from '../lib/config';
import { getPublicClient } from '../lib/client';

type Address = `0x${string}`;

const MINT_AMOUNT = parseUnits('1000', 6);

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

      const hash = await walletClient.writeContract({
        address: mockUsdcAddress,
        abi: MOCK_USDC_ABI,
        functionName: 'mint',
        args: [address, MINT_AMOUNT],
      });

      const client = getPublicClient(MONAD_TESTNET_CHAIN_ID);
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
