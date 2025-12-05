import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, usePublicClient } from 'wagmi';
import { parseUnits } from 'viem';
import { SOOTH_MARKET_ABI, ERC20_ABI, SOOTH_BALANCED_AMM_ABI, TRADER_VAULT_V3_ABI } from '../config/abis';
import { useDeployments } from './useDeployments';
import { useMarketStore } from '../store/useMarketStore';
import { useChainStore } from '../store/useChainStore';
import { getChainById } from '../lib/chains';
import { useMarket } from './useMarket';
import toast from 'react-hot-toast';
import { useActivityStore } from '../store/useActivityStore';
import { computeClientQuote } from './useTradeQuote';

export function useTrade(marketId: string) {
  const { address } = useAccount();
  const { mode, updateMarket } = useMarketStore();
  const { selectedChainId } = useChainStore();
  const { market, refetch: refetchMarket } = useMarket(marketId);
  const publicClient = usePublicClient();
  const deployments = useDeployments();
  
  const [isPending, setIsPending] = useState(false);
  const { writeContractAsync } = useWriteContract();

  // v3: Use TraderVaultV3 as single entry point
  const traderVaultAddress = deployments.TraderVaultV3 as `0x${string}`;

  // Balance Check - USDC Balance
  const { data: usdcBalance } = useReadContract({
    address: deployments.MockERC20 as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address || '0x0'],
    query: { 
      enabled: mode === 'real' && !!address,
    },
  });

  // v3: Check TraderVault available balance
  const { data: traderVaultBalance, refetch: refetchTraderVaultBalance } = useReadContract({
    address: traderVaultAddress,
    abi: TRADER_VAULT_V3_ABI,
    functionName: 'availableBalance',
    args: [address || '0x0'],
    query: {
      enabled: mode === 'real' && !!address && !!traderVaultAddress,
    },
  });

  // Allowance Check - Must approve the TraderVault contract
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: deployments.MockERC20 as `0x${string}`,
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
        address: deployments.MockERC20 as `0x${string}`,
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

  const trade = async (outcomeIndex: 0 | 1, shares: string, slippageBps: number = 50) => {
    setIsPending(true);
    try {
      const sharesBig = parseUnits(shares, 18);
      
      if (mode === 'demo') {
        // Simulation Logic
        await new Promise(r => setTimeout(r, 1000)); // Fake delay
        
        // Use the same LMSR algorithm as the quote hook
        const shareAmount = parseFloat(shares);
        const quote = computeClientQuote(market, outcomeIndex, shareAmount, slippageBps);
        
        if (!quote) {
          throw new Error('Failed to calculate demo trade');
        }

        // Update Market State
        const currentQYes = Number(market?.qYes || 0n) / 1e18;
        const currentQNo = Number(market?.qNo || 0n) / 1e18;
        
        const newQYes = outcomeIndex === 0 ? currentQYes + shareAmount : currentQYes;
        const newQNo = outcomeIndex === 1 ? currentQNo + shareAmount : currentQNo;

        updateMarket(marketId, {
          priceYes: quote.newPriceYes,
          priceNo: quote.newPriceNo,
          qYes: BigInt(Math.floor(newQYes * 1e18)),
          qNo: BigInt(Math.floor(newQNo * 1e18)),
          userYesShares: (market?.userYesShares || 0) + (outcomeIndex === 0 ? shareAmount : 0),
          userNoShares: (market?.userNoShares || 0) + (outcomeIndex === 1 ? shareAmount : 0),
        });
        
        // Log Activity
        useActivityStore.getState().addActivity({
          type: 'trade',
          market: market?.name || 'Unknown Market',
          description: `${outcomeIndex === 0 ? 'Buy YES' : 'Buy NO'} - ${shares} shares`,
          mode: 'demo',
          hash: `0x${Math.random().toString(16).slice(2)}`, // Fake hash
          timestamp: Date.now(),
        });

        toast.success(`Demo: Bought ${shares} ${outcomeIndex === 0 ? 'YES' : 'NO'} shares`);
        setIsPending(false);
        return;
      }

      // Real Mode - Chain Guard
      const chain = publicClient?.chain;
      
      if (chain?.id !== selectedChainId) {
        const targetChain = getChainById(selectedChainId);
        throw new Error(`Please switch to ${targetChain?.name || 'the correct network'} to trade`);
      }

      // Real Mode
      // 0. Refetch Market Data to ensure we have latest qYes/qNo/b
      await refetchMarket();
      
      const b = market?.bParam || 0n;
      const qYes = market?.qYes || 0n;
      const qNo = market?.qNo || 0n;
      const shareAmount = parseFloat(shares);
      
      console.log('Market State (Pre-Trade):', {
        bParam: b.toString(),
        qYes: qYes.toString(),
        qNo: qNo.toString(),
        marketId
      });

      // 1. Calculate Expected Cost using client-side LMSR
      // v3: TraderVault will calculate exact cost on-chain, we just need estimate for approval
      const quote = computeClientQuote(market, outcomeIndex, shareAmount, slippageBps);
      
      if (!quote) {
        throw new Error('Failed to calculate trade cost');
      }
      
      const expectedCost = parseUnits(Math.abs(quote.totalCost).toFixed(18), 18);
      
      console.log('Trade Cost Calculation:', {
        sharesBig: sharesBig.toString(),
        expectedCost: expectedCost.toString(),
        totalCost: quote.totalCost
      });
      
      // Add Slippage
      const BPS = 10000n;
      // maxCost is the algebraic limit for the inequality: cost <= maxCost
      // - For Buys (cost > 0, deltaShares > 0): maxCost > cost (willing to pay more)
      // - For Sells (cost < 0, deltaShares < 0): maxCost < cost (willing to receive less, i.e., more negative)
      
      let maxCost: bigint;
      const slippageFactor = BigInt(slippageBps);
      // BPS is already defined above

      if (sharesBig > 0n) {
        // Buy: Willing to pay MORE (e.g. 100 -> 105)
        // Use the displayed slippage only (no hidden buffer)
        maxCost = expectedCost * (BPS + slippageFactor) / BPS;
      } else {
        // Sell: Willing to receive LESS (e.g. -100 -> -95, which is closer to 0)
        // Use the displayed slippage only (no hidden buffer)
        maxCost = expectedCost * (BPS - slippageFactor) / BPS;
      }

      console.log('Slippage Calculation:', {
        slippageBps,
        expectedCost: expectedCost.toString(),
        maxCost: maxCost.toString(),
        isBuy: sharesBig > 0n
      });

      // [Existing calculation code remains same, just adding logs below]
      console.log('Trade Debug:', { 
        allowance: allowance?.toString(), 
        maxCost: maxCost.toString(),
        address 
      });

      // 2. Check Internal Balance (TraderVault)
      // In v3, trading uses the internal balance managed by TraderVault.
      // We don't need ERC20 allowance here because we aren't pulling funds from the wallet.
      // We just need to ensure the user has enough 'availableBalance' in the vault.
      
      const vaultBal = traderVaultBalance as bigint || 0n;
      if (sharesBig > 0n && vaultBal < maxCost) {
         throw new Error(`Insufficient Trading Account balance. You have ${(Number(vaultBal) / 1e18).toFixed(2)} USDC but need ${(Number(maxCost) / 1e18).toFixed(2)} USDC. Please deposit funds first.`);
      }

      // 3. Execute Trade
      console.log('Sending Trade Transaction...');
      if (!market?.contractAddress) {
        throw new Error('Market contract address not found');
      }

      // Check balance for Sells
      if (sharesBig < 0n) {
        const userShares = outcomeIndex === 0 ? market.userYesShares : market.userNoShares;
        const sellAmount = Math.abs(shareAmount);
        // Add small buffer for float comparison
        if ((userShares || 0) < sellAmount * 0.999) {
           throw new Error(`Insufficient shares. You have ${userShares?.toFixed(2)} but trying to sell ${sellAmount}`);
        }
      }

      // v3: Trade through TraderVaultV3.tradeAMM instead of Market.trade
      const client = publicClient;
      if (!client) throw new Error('Public client not found');
      
      try {
        console.log('Simulating trade...');
        await client.simulateContract({
          address: traderVaultAddress,
          abi: TRADER_VAULT_V3_ABI,
          functionName: 'tradeAMM',
          args: [market.contractAddress as `0x${string}`, outcomeIndex, sharesBig, maxCost],
          account: address,
        });
        console.log('Simulation successful');
      } catch (simError: any) {
        console.error('Simulation Failed:', simError);
        // Extract revert reason if possible
        const reason = simError.shortMessage || simError.message;
        throw new Error(`Transaction would fail: ${reason}`);
      }

      const hash = await writeContractAsync({
        address: traderVaultAddress,
        abi: TRADER_VAULT_V3_ABI,
        functionName: 'tradeAMM',
        args: [market.contractAddress as `0x${string}`, outcomeIndex, sharesBig, maxCost],
      });

      console.log('Trade Hash:', hash);
      const toastId = toast.loading('Transaction sent! Waiting for confirmation...');

      // 4. Wait for Receipt
      if (!publicClient) {
        throw new Error('Public client not found');
      }
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      
      if (receipt.status === 'success') {
        toast.success('Trade successful!', { id: toastId });
        // Refresh data
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
  };
}
