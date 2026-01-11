import { useState } from 'react';
import { useAccount, useWriteContract, useReadContracts, usePublicClient, useChainId } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { ABIS, ERC20_ABI } from '../config/abis';
import { useDeployments } from './useDeployments';
import { useMarketStore } from '../store/useMarketStore';
import { useActivityStore } from '../store/useActivityStore';
import { useChainStore } from '../store/useChainStore';
import { getPollingInterval } from '../lib/polling';
import toast from 'react-hot-toast';

/**
 * Hook for managing user trading funds in V9 TickBookVault
 * V9 Architecture: TickBookVault (USDC/Shares) + TickBookPoolManager (Orders)
 */
export function useTraderVault() {
  const chainId = useChainId();
  const { address } = useAccount();
  const { mode } = useMarketStore();
  const { selectedChainId } = useChainStore();
  const [isPending, setIsPending] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const { config } = useDeployments();
  const deployments = config.contracts;

  const vaultAddress = deployments.TickBookVault as `0x${string}`;
  const poolManagerAddress = deployments.TickBookPoolManager as `0x${string}`;
  const tokenAddress = deployments.MockUSDC as `0x${string}`;

  // Read user balances and vault data
  const { data, refetch } = useReadContracts({
    contracts: [
      { address: vaultAddress, abi: ABIS.TickBookVault, functionName: 'availableUsdcWad', args: [address || '0x0000000000000000000000000000000000000000'], chainId: Number(selectedChainId) },
      { address: vaultAddress, abi: ABIS.TickBookVault, functionName: 'reservedUsdcWad', args: [address || '0x0000000000000000000000000000000000000000'], chainId: Number(selectedChainId) },
      { address: tokenAddress, abi: ERC20_ABI, functionName: 'balanceOf', args: [address || '0x0000000000000000000000000000000000000000'], chainId: Number(selectedChainId) },
      { address: tokenAddress, abi: ERC20_ABI, functionName: 'allowance', args: [address || '0x0000000000000000000000000000000000000000', vaultAddress], chainId: Number(selectedChainId) },
      { address: tokenAddress, abi: ERC20_ABI, functionName: 'decimals', chainId: Number(selectedChainId) },
    ],
    query: {
      enabled: !!address && !!vaultAddress,
      refetchInterval: getPollingInterval(chainId, 'fast'),
    }
  });

  const [availableUsdc, reservedUsdc, userUsdcBalance, allowance, rawDecimals] = data?.map(r => r.result) || [];
  const decimals = Number(rawDecimals ?? 6);

  // Normalized data
  const currentAvailableBalance = availableUsdc as bigint || 0n;
  const currentReservedBalance = reservedUsdc as bigint || 0n;
  const currentTotalBalance = currentAvailableBalance + currentReservedBalance;
  const currentUserUsdc = userUsdcBalance as bigint || 0n;
  const currentAllowance = allowance as bigint || 0n;

  /**
   * Approve USDC for Vault
   */
  const approveUSDC = async (amount: string) => {
    if (isApproving) return;
    setIsApproving(true);
    const toastId = toast.loading('Checking allowance...');
    try {
      if (!publicClient) throw new Error('Public Client not initialized');
      if (!address) throw new Error('Wallet not connected');

      const amountBig = parseUnits(amount, decimals);

      toast.loading('Approving USDC for Vault...', { id: toastId });
      const hash = await writeContractAsync({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [vaultAddress, amountBig],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      toast.success('Approved!', { id: toastId });
      refetch();
      return true;
    } catch (e: any) {
      toast.error(e.message || 'Approval failed', { id: toastId });
      return false;
    } finally { setIsApproving(false); }
  };

  /**
   * Deposit USDC to V9 Vault
   */
  const deposit = async (amount: string | bigint) => {
    if (isPending || isApproving) return;
    setIsPending(true);
    try {
      if (!publicClient) throw new Error('Public Client not initialized');

      const amountBig = typeof amount === 'string' ? parseUnits(amount, decimals) : amount;

      if (currentAllowance < amountBig) {
        const approved = await approveUSDC(typeof amount === 'string' ? amount : formatUnits(amount, decimals));
        if (!approved) {
          setIsPending(false);
          return;
        }
      }

      const hash = await writeContractAsync({
        address: vaultAddress,
        abi: ABIS.TickBookVault,
        functionName: 'depositUsdc',
        args: [amountBig],
      });

      const toastId = toast.loading('Deposit submitted...');
      await publicClient.waitForTransactionReceipt({ hash });

      const amtStr = typeof amount === 'string' ? amount : formatUnits(amount, decimals);
      toast.success('Deposit successful!', { id: toastId });

      useActivityStore.getState().addActivity({
        type: 'deposit',
        market: 'Vault',
        description: `Deposited ${amtStr} USDC`,
        hash: hash,
        mode: mode,
        timestamp: Date.now(),
        chainId: publicClient.chain?.id
      });
      refetch();
    } catch (err: any) {
      toast.error(err.message?.split('\n')[0] || 'Deposit failed');
    } finally {
      setIsPending(false);
    }
  };

  /**
   * Withdraw USDC from V9 Vault
   */
  const withdraw = async (amount: string | bigint) => {
    setIsPending(true);
    try {
      if (!publicClient) throw new Error('Public Client not initialized');
      const amountBig = typeof amount === 'string' ? parseUnits(amount, decimals) : amount;

      const hash = await writeContractAsync({
        address: vaultAddress,
        abi: ABIS.TickBookVault,
        functionName: 'withdrawUsdc',
        args: [amountBig],
      });

      const toastId = toast.loading('Withdraw submitted...');
      await publicClient.waitForTransactionReceipt({ hash });

      const amtStr = typeof amount === 'string' ? amount : formatUnits(amount, decimals);
      toast.success('Withdraw successful!', { id: toastId });
      useActivityStore.getState().addActivity({
        type: 'withdraw',
        market: 'Vault',
        description: `Withdrew ${amtStr} USDC`,
        hash: hash,
        mode: mode,
        timestamp: Date.now(),
        chainId: publicClient.chain?.id
      });
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Withdraw failed');
    } finally {
      setIsPending(false);
    }
  };

  /**
   * Claim winnings from settled market (Redeem)
   */
  const claimWinnings = async (marketAddress: string) => {
    setIsPending(true);
    try {
      if (!publicClient) throw new Error('Public Client not initialized');
      const hash = await writeContractAsync({
        address: vaultAddress,
        abi: ABIS.TickBookVault,
        functionName: 'redeemResolved',
        args: [marketAddress as `0x${string}`],
      });
      const toastId = toast.loading('Claiming winnings...');
      await publicClient.waitForTransactionReceipt({ hash });
      toast.success('Winnings claimed!', { id: toastId });
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Claim failed');
    } finally { setIsPending(false); }
  };

  return {
    deposit,
    withdraw,
    claimWinnings,
    availableBalance: currentAvailableBalance,
    reservedBalance: currentReservedBalance,
    totalBalance: currentTotalBalance,
    userUsdcBalance: currentUserUsdc,
    allowance: currentAllowance,
    isPending,
    isLoading: mode === 'real' && !data,
    refetch,
    decimals,
    approveUSDC,
    vaultAddress
  };
}
