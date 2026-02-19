import { useState, useCallback } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { parseUnits } from 'viem';
import { getDeployment, ABIS } from '@sooth/sdk-core';
import { getPublicClient } from '../lib/client';
import { MONAD_MAINNET_CHAIN_ID } from '../lib/config';

type Address = `0x${string}`;

const ERC20_ABI = [
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
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
] as const;

export type TradeStatus = 'idle' | 'checking' | 'approving' | 'trading' | 'success' | 'error';

export interface UseAMMTradeResult {
  status: TradeStatus;
  error: string | null;
  txHash: Address | null;
  executeTrade: (
    marketAddress: Address,
    outcome: 0 | 1,
    sharesWad: bigint,
    maxCostWad: bigint
  ) => Promise<void>;
  reset: () => void;
}

export function useAMMTrade(): UseAMMTradeResult {
  const { address: userAddress } = useAccount();
  const [status, setStatus] = useState<TradeStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<Address | null>(null);

  const { writeContractAsync } = useWriteContract();

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setTxHash(null);
  }, []);

  const executeTrade = useCallback(
    async (marketAddress: Address, outcome: 0 | 1, sharesWad: bigint, maxCostWad: bigint) => {
      if (!userAddress) {
        setError('Wallet not connected');
        setStatus('error');
        return;
      }

      const deployment = getDeployment(MONAD_MAINNET_CHAIN_ID);
      if (!deployment) {
        setError('Deployment not found');
        setStatus('error');
        return;
      }

      const launchpadEngine = deployment.contracts.LaunchpadEngine as Address;
      const mockUSDC = deployment.contracts.MockUSDC as Address;
      const client = getPublicClient(MONAD_MAINNET_CHAIN_ID);

      try {
        setStatus('checking');
        setError(null);

        const [allowance, decimals] = await Promise.all([
          client.readContract({
            address: mockUSDC,
            abi: ERC20_ABI,
            functionName: 'allowance',
            args: [userAddress, launchpadEngine],
          }) as Promise<bigint>,
          client.readContract({
            address: mockUSDC,
            abi: ERC20_ABI,
            functionName: 'decimals',
          }) as Promise<number>,
        ]);

        const maxCostInTokenDecimals = decimals === 18 
          ? maxCostWad 
          : maxCostWad / BigInt(10 ** (18 - decimals));

        if (allowance < maxCostInTokenDecimals) {
          setStatus('approving');

          const approveAmount = parseUnits('1000000', decimals);
          const approveTx = await writeContractAsync({
            address: mockUSDC,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [launchpadEngine, approveAmount],
          });

          await client.waitForTransactionReceipt({ hash: approveTx, confirmations: 1 });
        }

        setStatus('trading');

        const tradeTx = await writeContractAsync({
          address: launchpadEngine,
          abi: ABIS.LaunchpadEngine,
          functionName: 'tradePositions',
          args: [marketAddress, outcome, sharesWad, maxCostWad],
        });

        setTxHash(tradeTx);

        await client.waitForTransactionReceipt({ hash: tradeTx, confirmations: 1 });

        setStatus('success');
      } catch (err) {
        console.error('Trade failed:', err);
        setError(err instanceof Error ? err.message : 'Trade failed');
        setStatus('error');
      }
    },
    [userAddress, writeContractAsync]
  );

  return {
    status,
    error,
    txHash,
    executeTrade,
    reset,
  };
}
