import { useState } from 'react';
import { useAccount, useWriteContract, useReadContracts, usePublicClient } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { TRADER_VAULT_V4_ABI, ERC20_ABI } from '../config/abis';
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
  const { config } = useDeployments();
  const deployments = config.contracts;

  const traderVaultAddress = deployments.SoothTraderVault as `0x${string}`;
  const tokenAddress = deployments.MockUSDC as `0x${string}`;

  // Read user balances and vault data
  const { data, refetch } = useReadContracts({
    contracts: [
      { address: traderVaultAddress, abi: TRADER_VAULT_V4_ABI, functionName: 'accounts', args: [address || '0x0'] },
      { address: tokenAddress, abi: ERC20_ABI, functionName: 'balanceOf', args: [address || '0x0'] },
      { address: tokenAddress, abi: ERC20_ABI, functionName: 'allowance', args: [address || '0x0', traderVaultAddress] },
      { address: tokenAddress, abi: ERC20_ABI, functionName: 'decimals' },
    ],
    query: {
      enabled: mode === 'real' && !!address,
      refetchInterval: 3000 // Sync with other hooks (3s)
    }
  });

  const [accountsStruct, userUsdcBalance, allowance, rawDecimals] = data?.map(r => r.result) || [];
  const decimals = Number(rawDecimals || 18);

  // V4 returns a tuple/struct for accounts: [available, pending]
  // Note: Wagmi/Viem might return it as an array or object depending on config. Assuming array for now based on ABI.
  const availableBalance = (accountsStruct as [bigint, bigint])?.[0] || 0n;
  const pendingBalance = (accountsStruct as [bigint, bigint])?.[1] || 0n;
  const totalBalance = availableBalance + pendingBalance;

  // Demo mode data
  const demoAvailableBalance = 500n * 10n ** 18n;
  const demoPendingBalance = 150n * 10n ** 18n;
  const demoTotalBalance = demoAvailableBalance + demoPendingBalance;
  const demoUserUsdc = 10000n * 10n ** 18n;

  // Normalized data
  const currentAvailableBalance = mode === 'demo' ? demoAvailableBalance : (availableBalance as bigint || 0n);
  const currentPendingBalance = mode === 'demo' ? demoPendingBalance : (pendingBalance as bigint || 0n);
  const currentTotalBalance = mode === 'demo' ? demoTotalBalance : (totalBalance as bigint || 0n);
  const currentUserUsdc = mode === 'demo' ? demoUserUsdc : (userUsdcBalance as bigint || 0n);
  const currentAllowance = mode === 'demo' ? 1000000n * 10n ** 18n : (allowance as bigint || 0n);

  /**
   * Approve USDC for Vault
   */
  const approveUSDC = async (amount: string) => {
    setIsPending(true);
    try {
      if (mode === 'demo') { await new Promise(r => setTimeout(r, 1000)); toast.success('Demo: Approved'); return; }
      if (!publicClient) throw new Error('Public Client not initialized');

      const amountBig = parseUnits(amount, decimals);
      const hash = await writeContractAsync({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [traderVaultAddress, amountBig],
      });
      const toastId = toast.loading('Approving USDC...');
      await publicClient?.waitForTransactionReceipt({ hash });
      toast.success('Approved!', { id: toastId });
      refetch();
    } catch (e: any) {
      toast.error(e.message || 'Approval failed');
    } finally { setIsPending(false); }
  };

  /**
   * Deposit USDC to trading vault
   */
  const deposit = async (amount: string) => {
    setIsPending(true);
    try {
      if (mode === 'demo') {
        // ... demo logic ...
        await new Promise(r => setTimeout(r, 1000));
        toast.success(`Demo: Deposited ${amount} USDC`);
        return;
      }

      if (!publicClient) throw new Error('Public Client not initialized');

      const amountBig = parseUnits(amount, decimals);

      // Explicit check: UI should prefer calling approveUSDC first, but we keep this safety
      if (currentAllowance < amountBig) {
        await approveUSDC(amount);
        // Re-check after approve (or just let user click again, but let's try to proceed)
        // But refetch might not be fast enough.
        // Better to throw "Please approve first" or let UI handle it.
        // For now, let's keep the existing flow but rely on the new UI to prevent this path.
      }

      console.log('Sending Deposit to:', traderVaultAddress);
      const hash = await writeContractAsync({
        address: traderVaultAddress,
        abi: TRADER_VAULT_V4_ABI,
        functionName: 'deposit',
        args: [amountBig],
      });

      const toastId = toast.loading('Deposit submitted...');
      // ... rest of function
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

      const amountBig = parseUnits(amount, decimals);

      const hash = await writeContractAsync({
        address: traderVaultAddress,
        abi: TRADER_VAULT_V4_ABI,
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
  /**
   * Claim Winnings (V4 Settlement)
   */
  const claimWinnings = async (marketAddress: string) => {
    setIsPending(true);
    try {
      if (mode === 'demo') {
        await new Promise(r => setTimeout(r, 1000));
        toast.success('Demo: Claimed winnings');
        return;
      }
      toast.error("Claims handled via Merge outcomes in V4");
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


  /**
   * Place a limit order (V3 Unified Orderbook)
   * @param marketAddress - Market contract address
   * @param outcome - 0 = YES, 1 = NO
   * @param price - Price per share (e.g., "0.60" for 60 cents)
   * @param amount - Number of shares (e.g., "100")
   */
  const placeOrder = async (marketAddress: string, outcome: number, price: string, amount: string, isBuy: boolean = true) => {
    setIsPending(true);
    try {
      if (mode === 'demo') {
        await new Promise(r => setTimeout(r, 1000));
        toast.success(`Demo: Placed ${isBuy ? 'Buy' : 'Sell'} ${outcome === 0 ? 'YES' : 'NO'} order @ ${price}`);
        useActivityStore.getState().addActivity({
          type: 'trade',
          market: marketAddress,
          description: `Placed ${isBuy ? 'Buy' : 'Sell'} order: ${amount} ${outcome === 0 ? 'YES' : 'NO'} @ ${price}`,
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
        abi: TRADER_VAULT_V4_ABI,
        functionName: 'placeOrder',
        args: [marketAddress as `0x${string}`, outcome, priceWad, amountWad, isBuy],
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
        abi: TRADER_VAULT_V4_ABI,
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
   * Deposit ERC1155 shares into the Vault (Custodial)
   */
  const depositShares = async (marketAddress: string, outcome: number, amount: string) => {
    setIsPending(true);
    try {
      if (mode === 'demo') { await new Promise(r => setTimeout(r, 1000)); toast.success('Demo: Shares deposited'); return; }
      if (!publicClient) throw new Error('Public Client not initialized');

      const amountBig = parseUnits(amount, 18);
      const hash = await writeContractAsync({
        address: traderVaultAddress,
        abi: TRADER_VAULT_V4_ABI,
        functionName: 'depositShares',
        args: [marketAddress as `0x${string}`, outcome, amountBig],
      });
      const toastId = toast.loading('Depositing shares...');
      await publicClient.waitForTransactionReceipt({ hash });
      toast.success('Shares deposited!', { id: toastId });
      refetch();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Deposit shares failed');
    } finally { setIsPending(false); }
  };

  /**
   * Withdraw shares from Vault to Wallet
   */
  const withdrawShares = async (marketAddress: string, outcome: number, amount: string) => {
    setIsPending(true);
    try {
      if (mode === 'demo') { await new Promise(r => setTimeout(r, 1000)); toast.success('Demo: Shares withdrawn'); return; }
      if (!publicClient) throw new Error('Public Client not initialized');

      const amountBig = parseUnits(amount, 18);
      const hash = await writeContractAsync({
        address: traderVaultAddress,
        abi: TRADER_VAULT_V4_ABI,
        functionName: 'withdrawShares',
        args: [marketAddress as `0x${string}`, outcome, amountBig],
      });
      const toastId = toast.loading('Withdrawing shares...');
      await publicClient.waitForTransactionReceipt({ hash });
      toast.success('Shares withdrawn!', { id: toastId });
      refetch();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Withdraw shares failed');
    } finally { setIsPending(false); }
  };

  /**
   * Place Spot Sell Order (uses internal shareBalances)
   */
  const placeSpotOrder = async (marketAddress: string, outcome: number, price: string, amount: string) => {
    setIsPending(true);
    try {
      if (mode === 'demo') { await new Promise(r => setTimeout(r, 1000)); toast.success('Demo: Spot Sell placed'); return 0n; }
      if (!publicClient) throw new Error('Public Client not initialized');

      const priceWad = parseUnits(price, 18);
      const amountWad = parseUnits(amount, 18);

      const hash = await writeContractAsync({
        address: traderVaultAddress,
        abi: TRADER_VAULT_V4_ABI,
        functionName: 'placeSpotOrder',
        args: [marketAddress as `0x${string}`, outcome, priceWad, amountWad],
      });
      const toastId = toast.loading('Placing spot sell...');
      await publicClient.waitForTransactionReceipt({ hash });
      toast.success('Spot Sell Placed!', { id: toastId });
      refetch();
      return 0n;
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Spot sell failed');
      throw err;
    } finally { setIsPending(false); }
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
      if (!address) throw new Error('Wallet not connected');

      const isBuy = parseFloat(deltaShares) > 0;
      const absShares = deltaShares.replace('-', '');
      const sharesBig = parseUnits(absShares, 18);
      const sharesSigned = isBuy ? sharesBig : -sharesBig;

      // Auto-Deposit Logic for BUY
      if (isBuy) {
        // Fetch current available balance in Vault directly to avoid stale state
        const available = await publicClient.readContract({
          address: traderVaultAddress,
          abi: TRADER_VAULT_V4_ABI,
          functionName: 'availableBalance',
          args: [address]
        }) as bigint;

        const costAsset = parseUnits(maxCost, decimals);

        if (available < costAsset) {
          const needed = costAsset - available;
          const neededStr = formatUnits(needed, decimals);

          // Check allowance
          if (currentAllowance < needed) {
            const toastApprove = toast.loading('Approving USDC for deposit...');
            try {
              // Determine approval amount (use needed amount)
              const hashApprove = await writeContractAsync({
                address: deployments.MockUSDC as `0x${string}`,
                abi: ERC20_ABI,
                functionName: 'approve',
                args: [traderVaultAddress, needed],
              });
              await publicClient.waitForTransactionReceipt({ hash: hashApprove });
              toast.success('Approved!', { id: toastApprove });
              // Note: We don't explicitly update currentAllowance state here, 
              // but the chain is updated for the next tx.
            } catch (e: any) {
              toast.error('Approval failed', { id: toastApprove });
              throw e;
            }
          }

          // Deposit
          const tId = toast.loading(`Depositing ${neededStr} USDC...`);
          try {
            const depHash = await writeContractAsync({
              address: traderVaultAddress,
              abi: TRADER_VAULT_V4_ABI,
              functionName: 'deposit',
              args: [needed]
            });
            await publicClient.waitForTransactionReceipt({ hash: depHash });
            toast.success('Deposit successful', { id: tId });
            // Wait for indexing to prevent "insufficient balance" in next call
            await new Promise(resolve => setTimeout(resolve, 2000));
          } catch (e) {
            toast.error('Deposit failed', { id: tId });
            throw e;
          }
        }
      }

      // Proceed to Trade
      const maxCostAsset = parseUnits(maxCost, decimals);

      const hash = await writeContractAsync({
        address: traderVaultAddress,
        abi: TRADER_VAULT_V4_ABI,
        functionName: 'tradeAMM',
        args: [
          marketAddress as `0x${string}`,
          outcome,
          sharesSigned,
          maxCostAsset,
        ],
      });

      const toastId = toast.loading('Executing trade...');
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success') {
        const action = isBuy ? 'Bought' : 'Sold';
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
    // claimUnlocked, // Removed in V4 (auto-unlock or different mechanism)
    claimWinnings, // Replaces redeem
    // Trading (V4)
    placeOrder,
    placeSpotOrder,
    cancelOrder,
    executeAMMTrade: tradeAMM,

    // Custodial Management
    depositShares,
    withdrawShares,

    // State
    availableBalance: currentAvailableBalance,
    pendingBalance: currentPendingBalance,
    totalBalance: currentTotalBalance,
    userUsdcBalance: currentUserUsdc,
    allowance: currentAllowance,
    isPending,
    isLoading: mode === 'real' && !data,
    refetch,
    decimals,

    // Actions
    approveUSDC,
    traderVaultAddress
  };
}

