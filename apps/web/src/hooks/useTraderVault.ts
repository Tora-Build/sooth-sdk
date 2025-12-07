import { useState } from 'react';
import { useAccount, useWriteContract, useReadContracts, usePublicClient } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { TRADER_VAULT_V3_ABI, ERC20_ABI } from '../config/abis';
import { useDeployments } from './useDeployments';
import { useMarketStore } from '../store/useMarketStore';
import { useActivityStore } from '../store/useActivityStore';
import toast from 'react-hot-toast';

/**
 * Hook for managing user trading funds in TraderVaultV3
 * V3 Architecture: Single entry point for all trading operations
 */
export function useTraderVault() {
  const { address } = useAccount();
  const { mode } = useMarketStore();
  const [isPending, setIsPending] = useState(false);
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const deployments = useDeployments();
  
  const traderVaultAddress = deployments.SoothTraderVault as `0x${string}`;
  const tokenAddress = deployments.MockUSDC as `0x${string}`;

  // Read user balances and vault data
  const { data, refetch } = useReadContracts({
    contracts: [
      { address: traderVaultAddress, abi: TRADER_VAULT_V3_ABI, functionName: 'availableBalance', args: [address || '0x0'] },
      { address: traderVaultAddress, abi: TRADER_VAULT_V3_ABI, functionName: 'pendingBalance', args: [address || '0x0'] },
      { address: traderVaultAddress, abi: TRADER_VAULT_V3_ABI, functionName: 'totalBalance', args: [address || '0x0'] },
      { address: tokenAddress, abi: ERC20_ABI, functionName: 'balanceOf', args: [address || '0x0'] },
      { address: tokenAddress, abi: ERC20_ABI, functionName: 'allowance', args: [address || '0x0', traderVaultAddress] },
      { address: tokenAddress, abi: ERC20_ABI, functionName: 'decimals' },
    ],
    query: { 
      enabled: mode === 'real' && !!address,
      refetchInterval: 30000 // Increased to 30s to prevent MegaETH RPC rate limiting
    }
  });

  const [availableBalance, pendingBalance, totalBalance, userUsdcBalance, allowance, rawDecimals] = data?.map(r => r.result) || [];
  const decimals = Number(rawDecimals || 18);

  // Demo mode data
  const demoAvailableBalance = 500n * 10n**18n;
  const demoPendingBalance = 150n * 10n**18n;
  const demoTotalBalance = demoAvailableBalance + demoPendingBalance;
  const demoUserUsdc = 10000n * 10n**18n;

  // Normalized data
  const currentAvailableBalance = mode === 'demo' ? demoAvailableBalance : (availableBalance as bigint || 0n);
  const currentPendingBalance = mode === 'demo' ? demoPendingBalance : (pendingBalance as bigint || 0n);
  const currentTotalBalance = mode === 'demo' ? demoTotalBalance : (totalBalance as bigint || 0n);
  const currentUserUsdc = mode === 'demo' ? demoUserUsdc : (userUsdcBalance as bigint || 0n);

  /**
   * Deposit USDC to trading vault
   */
  const deposit = async (amount: string) => {
    setIsPending(true);
    try {
      if (mode === 'demo') {
        await new Promise(r => setTimeout(r, 1000));
        toast.success(`Demo: Deposited ${amount} USDC`);
        useActivityStore.getState().addActivity({
          type: 'deposit',
          market: 'Trading Vault',
          description: `Deposited ${amount} USDC`,
          mode: 'demo',
          hash: `0x${Math.random().toString(16).slice(2)}`,
          timestamp: Date.now()
        });
        return;
      }

      const amountBig = parseUnits(amount, decimals);
      
      if (!publicClient) throw new Error('Public Client not initialized');
      
      // Check current allowance and balance
      const [allowanceVal, balanceVal] = await Promise.all([
        publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [address || '0x0', traderVaultAddress]
        }),
        publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [address || '0x0']
        })
      ]) as [bigint, bigint];

      if (balanceVal < amountBig) {
        throw new Error(`Insufficient USDC balance. Found ${formatUnits(balanceVal, decimals)} USDC, needed ${amount}.`);
      }

      console.log('Deposit Debug:', { 
        amount: amountBig.toString(), 
        allowance: allowanceVal.toString(),
        needsApproval: allowanceVal < amountBig,
        tokenAddress,
        traderVaultAddress
      });

      // Approve if needed
      if (allowanceVal < amountBig) {
        const tx = await writeContractAsync({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [traderVaultAddress, amountBig],
        });
        
        const toastId = toast.loading('Approving USDC...');
        console.log('Approval Sent:', tx);
        
        const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
        console.log('Approval Mined:', receipt.status);
        
        if (receipt.status !== 'success') {
          throw new Error('Approval transaction failed');
        }
        toast.success('Approved!', { id: toastId });
      }

      // Deposit
      console.log('Sending Deposit...');
      const hash = await writeContractAsync({
        address: traderVaultAddress,
        abi: TRADER_VAULT_V3_ABI,
        functionName: 'deposit',
        args: [amountBig],
      });
      
      const toastId = toast.loading('Deposit submitted...');
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      
      if (receipt.status === 'success') {
        toast.success('Deposit successful!', { id: toastId });
        useActivityStore.getState().addActivity({
          type: 'deposit',
          market: 'Trading Vault',
          description: `Deposited ${amount} USDC`,
          hash: hash,
          mode: mode,
          timestamp: Date.now(),
          chainId: publicClient?.chain?.id
        });
        refetch();
      } else {
        throw new Error('Deposit transaction reverted');
      }
    } catch (err: any) {
      console.error('Deposit Error:', err);
      toast.error(err.message?.split('\n')[0] || 'Deposit failed');
    } finally {
      setIsPending(false);
    }
  };

  /**
   * Withdraw available balance from trading vault
   */
  const withdraw = async (amount: string) => {
    setIsPending(true);
    try {
      if (mode === 'demo') {
        await new Promise(r => setTimeout(r, 1000));
        toast.success(`Demo: Withdrew ${amount} USDC`);
        useActivityStore.getState().addActivity({
          type: 'withdraw',
          market: 'Trading Vault',
          description: `Withdrew ${amount} USDC`,
          mode: 'demo',
          timestamp: Date.now()
        });
        return;
      }

      if (!publicClient) throw new Error('Public Client not initialized');

      if (!publicClient) throw new Error('Public Client not initialized');
  
      const amountBig = parseUnits(amount, decimals);
      
      const hash = await writeContractAsync({
        address: traderVaultAddress,
        abi: TRADER_VAULT_V3_ABI,
        functionName: 'withdraw',
        args: [amountBig],
      });

      const toastId = toast.loading('Withdraw submitted...');
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      
      if (receipt.status === 'success') {
        toast.success('Withdraw successful!', { id: toastId });
        useActivityStore.getState().addActivity({
          type: 'withdraw',
          market: 'Trading Vault',
          description: `Withdrew ${amount} USDC`,
          hash: hash,
          mode: mode,
          timestamp: Date.now(),
          chainId: publicClient.chain.id
        });
        refetch();
      } else {
        throw new Error('Withdraw transaction reverted');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Withdraw failed');
    } finally {
      setIsPending(false);
    }
  };

  /**
   * Claim unlocked pending balance (after 48h lock period)
   */
  const claimUnlocked = async () => {
    setIsPending(true);
    try {
      if (mode === 'demo') {
        await new Promise(r => setTimeout(r, 1000));
        toast.success('Demo: Claimed unlocked funds');
        useActivityStore.getState().addActivity({
          type: 'claim',
          market: 'Trading Vault',
          description: 'Claimed unlocked funds',
          mode: 'demo',
          timestamp: Date.now()
        });
        return;
      }

      if (!publicClient) throw new Error('Public Client not initialized');
      
      const hash = await writeContractAsync({
        address: traderVaultAddress,
        abi: TRADER_VAULT_V3_ABI,
        functionName: 'claimUnlocked',
        args: [],
      });

      const toastId = toast.loading('Claiming unlocked funds...');
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      
      if (receipt.status === 'success') {
        toast.success('Claimed successfully!', { id: toastId });
        useActivityStore.getState().addActivity({
          type: 'claim',
          market: 'Trading Vault',
          description: 'Claimed unlocked funds',
          hash: hash,
          mode: mode,
          timestamp: Date.now(),
          chainId: publicClient.chain.id
        });
        refetch();
      } else {
        throw new Error('Claim transaction reverted');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Claim failed');
    } finally {
      setIsPending(false);
    }
  };

  /**
   * Redeem winning shares for USDC
   */
  const redeem = async (marketAddress: string) => {
    setIsPending(true);
    try {
      if (mode === 'demo') {
        await new Promise(r => setTimeout(r, 1000));
        toast.success('Demo: Redeemed winning shares');
        return;
      }

      if (!publicClient) throw new Error('Public Client not initialized');

      const hash = await writeContractAsync({
        address: traderVaultAddress,
        abi: TRADER_VAULT_V3_ABI,
        functionName: 'redeem',
        args: [marketAddress as `0x${string}`],
      });

      const toastId = toast.loading('Redeeming shares...');
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success') {
        toast.success('Redeemed successfully!', { id: toastId });
        refetch();
      } else {
        throw new Error('Redeem transaction reverted');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Redeem failed');
    } finally {
      setIsPending(false);
    }
  };

  /**
   * Place a limit order (V3 Unified Orderbook)
   * @param marketAddress - Market contract address
   * @param outcome - 0 = YES, 1 = NO
   * @param price - Price per share (e.g., "0.60" for 60 cents)
   * @param amount - Number of shares (e.g., "100")
   */
  const placeOrder = async (marketAddress: string, outcome: number, price: string, amount: string) => {
    setIsPending(true);
    try {
      if (mode === 'demo') {
        await new Promise(r => setTimeout(r, 1000));
        toast.success(`Demo: Placed ${outcome === 0 ? 'YES' : 'NO'} order @ ${price}`);
        useActivityStore.getState().addActivity({
          type: 'trade',
          market: marketAddress,
          description: `Placed limit order: ${amount} ${outcome === 0 ? 'YES' : 'NO'} @ ${price}`,
          mode: 'demo',
          timestamp: Date.now()
        });
        return 0n; // Demo order ID
      }

      if (!publicClient) throw new Error('Public Client not initialized');

      const priceWad = parseUnits(price, 18);
      const amountWad = parseUnits(amount, 18);

      const hash = await writeContractAsync({
        address: traderVaultAddress,
        abi: TRADER_VAULT_V3_ABI,
        functionName: 'placeOrder',
        args: [marketAddress as `0x${string}`, outcome, priceWad, amountWad],
      });

      const toastId = toast.loading('Placing order...');
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success') {
        toast.success('Order placed!', { id: toastId });
        useActivityStore.getState().addActivity({
          type: 'trade',
          market: marketAddress,
          description: `Placed limit order: ${amount} ${outcome === 0 ? 'YES' : 'NO'} @ ${price}`,
          hash,
          mode,
          timestamp: Date.now(),
          chainId: publicClient.chain?.id
        });
        refetch();
        // TODO: Extract orderId from event logs
        return 0n;
      } else {
        throw new Error('Order transaction reverted');
      }
    } catch (err: any) {
      console.error('Place order error:', err);
      toast.error(err.message?.split('\n')[0] || 'Order failed');
      throw err;
    } finally {
      setIsPending(false);
    }
  };

  /**
   * Cancel an existing order
   * @param marketAddress - Market contract address
   * @param orderId - Order ID to cancel
   */
  const cancelOrder = async (marketAddress: string, orderId: bigint) => {
    setIsPending(true);
    try {
      if (mode === 'demo') {
        await new Promise(r => setTimeout(r, 1000));
        toast.success('Demo: Order cancelled');
        return;
      }

      if (!publicClient) throw new Error('Public Client not initialized');

      const hash = await writeContractAsync({
        address: traderVaultAddress,
        abi: TRADER_VAULT_V3_ABI,
        functionName: 'cancelOrder',
        args: [marketAddress as `0x${string}`, orderId],
      });

      const toastId = toast.loading('Cancelling order...');
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success') {
        toast.success('Order cancelled!', { id: toastId });
        useActivityStore.getState().addActivity({
          type: 'trade',
          market: marketAddress,
          description: `Cancelled order #${orderId}`,
          hash,
          mode,
          timestamp: Date.now(),
          chainId: publicClient.chain?.id
        });
        refetch();
      } else {
        throw new Error('Cancel transaction reverted');
      }
    } catch (err: any) {
      console.error('Cancel order error:', err);
      toast.error(err.message?.split('\n')[0] || 'Cancel failed');
      throw err;
    } finally {
      setIsPending(false);
    }
  };

  /**
   * Execute AMM trade (market order with slippage protection)
   * @param marketAddress - Market contract address
   * @param outcome - 0 = YES, 1 = NO
   * @param deltaShares - Positive = buy, negative = sell (e.g., "100" or "-50")
   * @param maxCost - Max USDC to spend (buy) or min to receive (sell)
   */
  const tradeAMM = async (marketAddress: string, outcome: number, deltaShares: string, maxCost: string) => {
    setIsPending(true);
    try {
      if (mode === 'demo') {
        await new Promise(r => setTimeout(r, 1000));
        const action = parseFloat(deltaShares) > 0 ? 'Bought' : 'Sold';
        toast.success(`Demo: ${action} ${Math.abs(parseFloat(deltaShares))} ${outcome === 0 ? 'YES' : 'NO'} shares`);
        useActivityStore.getState().addActivity({
          type: 'trade',
          market: marketAddress,
          description: `${action} ${Math.abs(parseFloat(deltaShares))} ${outcome === 0 ? 'YES' : 'NO'} shares`,
          mode: 'demo',
          timestamp: Date.now()
        });
        return;
      }

      if (!publicClient) throw new Error('Public Client not initialized');

      const deltaWad = parseUnits(deltaShares, 18);
      const maxCostWad = parseUnits(maxCost, 18);

      const hash = await writeContractAsync({
        address: traderVaultAddress,
        abi: TRADER_VAULT_V3_ABI,
        functionName: 'tradeAMM',
        args: [marketAddress as `0x${string}`, outcome, deltaWad, maxCostWad],
      });

      const toastId = toast.loading('Executing trade...');
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success') {
        const action = parseFloat(deltaShares) > 0 ? 'Bought' : 'Sold';
        toast.success(`${action} shares!`, { id: toastId });
        useActivityStore.getState().addActivity({
          type: 'trade',
          market: marketAddress,
          description: `${action} ${Math.abs(parseFloat(deltaShares))} ${outcome === 0 ? 'YES' : 'NO'} shares`,
          hash,
          mode,
          timestamp: Date.now(),
          chainId: publicClient.chain?.id
        });
        refetch();
      } else {
        throw new Error('Trade transaction reverted');
      }
    } catch (err: any) {
      console.error('Trade error:', err);
      toast.error(err.message?.split('\n')[0] || 'Trade failed');
      throw err;
    } finally {
      setIsPending(false);
    }
  };

  return {
    // Account management
    deposit,
    withdraw,
    claimUnlocked,
    redeem,
    // Trading (V3)
    placeOrder,
    cancelOrder,
    tradeAMM,
    // State
    availableBalance: currentAvailableBalance,
    pendingBalance: currentPendingBalance,
    totalBalance: currentTotalBalance,
    userUsdcBalance: currentUserUsdc,
    isPending,
    isLoading: mode === 'real' && !data,
    refetch,
    decimals,
  };
}

