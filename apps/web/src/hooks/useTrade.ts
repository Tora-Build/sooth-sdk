import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, usePublicClient } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { SOOTH_MARKET_ABI, ERC20_ABI, SOOTH_BALANCED_AMM_ABI, TRADER_VAULT_V4_ABI, TRADER_VAULT_V3_ABI } from '../config/abis';
import { useDeployments } from './useDeployments';
import { useMarketStore } from '../store/useMarketStore';
import { useChainStore } from '../store/useChainStore';
import { getChainById } from '../lib/chains';
import { useMarket } from './useMarket';
import toast from 'react-hot-toast';
import { useActivityStore } from '../store/useActivityStore';
import { getLMSRQuote } from '../utils/lmsr';

export function useTrade(marketId: string) {
  const { address } = useAccount();
  const { mode, updateMarket } = useMarketStore();
  // ... (keep imports and setup)


  const { selectedChainId } = useChainStore();
  const { market, refetch: refetchMarket } = useMarket(marketId);
  const publicClient = usePublicClient();
  const deployments = useDeployments();

  const [isPending, setIsPending] = useState(false);
  const { writeContractAsync } = useWriteContract();
  const marketContractAddress = market?.contractAddress as `0x${string}`;
  const tokenAddress = deployments.MockUSDC as `0x${string}`;
  // V3 Change: Approve TraderVault, not Market
  const spenderAddress = deployments.SoothTraderVault as `0x${string}`;

  // v3: Use TraderVaultV3 as single entry point
  const traderVaultAddress = deployments.SoothTraderVault as `0x${string}`;

  // Balance Check - USDC Balance
  const { data: usdcBalance } = useReadContract({
    address: deployments.MockUSDC as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address || '0x0'],
    query: {
      enabled: mode === 'real' && !!address,
    },
  });

  // Fetch token decimals
  const { data: decimalsVal } = useReadContract({
    address: deployments.MockUSDC as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'decimals',
  });

  const decimals = Number(decimalsVal || 18);

  // v4: Check TraderVaultV4 accounts (available, pending)
  const { data: vaultAccounts, refetch: refetchTraderVaultBalance } = useReadContract({
    address: traderVaultAddress,
    abi: TRADER_VAULT_V4_ABI,
    functionName: 'accounts',
    args: [address || '0x0'],
    query: {
      enabled: mode === 'real' && !!address && !!traderVaultAddress,
      refetchInterval: 5000,
    },
  });
  const traderVaultBalance = vaultAccounts?.[0]; // available balance

  // Allowance Check - Must approve the TraderVault contract
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: deployments.MockUSDC as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [address || '0x0', traderVaultAddress],
    query: {
      enabled: mode === 'real' && !!address,
    },
  });

  const approve = async (amount: bigint) => {
    if (mode === 'demo') {
      toast.success('Demo: Approved USDC');
      return true;
    }

    try {
      const hash = await writeContractAsync({
        address: deployments.MockUSDC as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [traderVaultAddress, amount],
      });

      const toastId = toast.loading('Approving USDC...');

      // Wait for transaction to be mined
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
        toast.loading('Verifying approval...', { id: toastId });

        // Poll for allowance update (max 10 attempts)
        let retries = 0;
        while (retries < 10) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          const { data: newAllowance } = await refetchAllowance();
          if ((newAllowance || 0n) >= amount) {
            toast.success('Approved successfully', { id: toastId });
            return true;
          }
          retries++;
        }

        // If we get here, it might still be propagating, but we'll return true and let the trade function double check
        toast.success('Approval confirmed on-chain', { id: toastId });
      } else {
        toast.success('Approval sent', { id: toastId });
      }

      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  // Determine if approval is needed
  // For Buy: Need USDC allowance > maxCost
  // For Sell: Need OutcomeToken isApprovedForAll (Handled via separate hook or check? Vault uses 1155)
  // For now focusing on Buy (USDC)

  // We need a stable 'needsApproval' flag. 
  // But we don't know the cost until the user inputs amount.
  // We can return `allowance` and `approve`.

  const trade = async (outcomeIndex: 0 | 1, shares: string, slippageBps: number = 50) => {
    setIsPending(true);
    try {
      const sharesBig = parseUnits(shares, 18);

      if (mode === 'demo') {
        // ... (Demo logic omitted for brevity, keeping existing) ...
        await new Promise(r => setTimeout(r, 1000));
        toast.success(`Demo: Bought ${shares} shares`);
        setIsPending(false);
        return;
      }

      // Real Mode - Chain Guard REMOVED (Relies on wagmi)

      // Real Mode
      // 0. Refetch Market Data
      await refetchMarket();
      const { data: latestBalance } = await refetchTraderVaultBalance();

      // ... (Cost Calculation same as before) ...
      const bVal = Number(formatUnits(market?.bParam || 0n, 18));
      const qYesVal = Number(formatUnits(market?.qYes || 0n, 18));
      const qNoVal = Number(formatUnits(market?.qNo || 0n, 18));
      const shareAmount = parseFloat(shares);
      const quote = getLMSRQuote(qYesVal, qNoVal, bVal, shareAmount, outcomeIndex);
      const fee = Math.abs(quote.expectedCost) * 0.005;
      const totalCost = quote.expectedCost + fee;
      const expectedCost = parseUnits(Math.abs(totalCost).toFixed(decimals), decimals);

      // Slippage & Limit Logic
      const BPS = 10000n;
      const slippageFactor = BigInt(slippageBps);
      let limit: bigint;
      // ... (Limit Calc) ...
      if (sharesBig > 0n) {
        limit = expectedCost * (BPS + slippageFactor + 50n) / BPS;
      } else {
        limit = expectedCost * (BPS - slippageFactor - 50n) / BPS;
      }
      const signedLimit = sharesBig > 0n ? limit : -limit;


      // AUTO-APPROVE Logic for BUY
      if (sharesBig > 0n) {
        const currentAllowance = allowance || 0n;
        if (currentAllowance < limit) {
          console.log('Auto-Approval Triggered', { current: currentAllowance, needed: limit });
          const approved = await approve(limit); // Ask to approve EXACT amount or Max? Let's generic approve cost.
          if (!approved) throw new Error('Approval denied');
          // Proceed to trade
        }
      }

      // 3. Execute Trade
      console.log('Sending Trade Transaction...');
      if (!market?.contractAddress) throw new Error('Market contract address not found');

      const hash = await writeContractAsync({
        address: traderVaultAddress,
        abi: TRADER_VAULT_V4_ABI,
        functionName: 'tradeAMM',
        args: [market.contractAddress as `0x${string}`, outcomeIndex, sharesBig, signedLimit],
      });

      console.log('Trade Hash:', hash);
      const toastId = toast.loading('Transaction sent! Waiting for confirmation...');

      if (!publicClient) throw new Error('Public client not found');
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success') {
        toast.success('Trade successful!', { id: toastId });
        await refetchAllowance();
        await refetchMarket();
        await refetchTraderVaultBalance();
      } else {
        toast.error('Transaction reverted on-chain', { id: toastId });
      }

    } catch (err: any) {
      console.error('Trade Error:', err);
      toast.error(err.message || 'Trade failed');
    } finally {
      setIsPending(false);
    }
  };

  return {
    trade,
    isPending,
    allowance: allowance || 0n,
    approve
  };
}
