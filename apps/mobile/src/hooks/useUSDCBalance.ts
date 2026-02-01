import { useQuery } from '@tanstack/react-query';
import { getPublicClient } from '../lib/client';
import { getDeployment } from '@sooth/sdk-core';
import { formatUnits, maxUint256 } from 'viem';
import { getWalletClient } from '../lib/client';

type Address = `0x${string}`;

const CHAIN_ID = 84532;

// Minimal ERC20 ABI for MockUSDC
const MockUsdcABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
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

export interface USDCBalanceData {
  balance: bigint;
  balanceFormatted: string;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook to fetch user's USDC balance on Base Sepolia
 */
export function useUSDCBalance(userAddress: Address | undefined): USDCBalanceData {
  const deployment = getDeployment(CHAIN_ID);
  const mockUsdcAddress = deployment?.contracts.MockUSDC as Address | undefined;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['usdc-balance', userAddress, CHAIN_ID],
    queryFn: async () => {
      if (!userAddress || !mockUsdcAddress) return 0n;
      const client = getPublicClient();
      const balance = await client.readContract({
        address: mockUsdcAddress,
        abi: MockUsdcABI,
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
  const balanceFormatted = formatUnits(balance, 18);
  const displayBalance = Number(balanceFormatted).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return {
    balance,
    balanceFormatted: displayBalance,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}

/**
 * Check USDC allowance for a spender
 */
export async function checkAllowance(
  owner: Address,
  spender: Address
): Promise<bigint> {
  const deployment = getDeployment(CHAIN_ID);
  if (!deployment) return 0n;
  const client = getPublicClient();
  const allowance = await client.readContract({
    address: deployment.contracts.MockUSDC as Address,
    abi: MockUsdcABI,
    functionName: 'allowance',
    args: [owner, spender],
  });
  return allowance as bigint;
}

/**
 * Approve USDC spending (max approval)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function approveUSDC(
  provider: any,
  userAddress: Address,
  spender: Address
): Promise<void> {
  const deployment = getDeployment(CHAIN_ID);
  if (!deployment) throw new Error('No deployment found');
  const walletClient = getWalletClient(provider, userAddress);
  await walletClient.writeContract({
    address: deployment.contracts.MockUSDC as Address,
    abi: MockUsdcABI,
    functionName: 'approve',
    args: [spender, maxUint256],
  });
}

/**
 * Mint testnet USDC (1000 USDC)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function mintTestnetUSDC(
  provider: any,
  recipient: Address
): Promise<void> {
  const deployment = getDeployment(CHAIN_ID);
  if (!deployment) throw new Error('No deployment found');
  const walletClient = getWalletClient(provider, recipient);
  await walletClient.writeContract({
    address: deployment.contracts.MockUSDC as Address,
    abi: MockUsdcABI,
    functionName: 'mint',
    args: [recipient, 1000n * 10n ** 18n],
  });
}

export { MockUsdcABI };
