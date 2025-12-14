import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, usePublicClient } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { ERC20_ABI, TRADER_VAULT_V4_ABI } from '../config/abis';
import { useDeployments } from './useDeployments';
import { useMarketStore } from '../store/useMarketStore';
import { useAmmMarket } from './useAmmMarket';
import toast from 'react-hot-toast';
import { useActivityStore } from '../store/useActivityStore';
import { getLMSRQuote } from '../utils/lmsr';

export function useAmmTrade(marketId: string) {
  const { address } = useAccount();
  const { mode, updateMarket } = useMarketStore();
  // ... (keep imports and setup)

  const { market, refetch: refetchMarket } = useAmmMarket(marketId);
  const publicClient = usePublicClient();
  const { config } = useDeployments();
  const deployments = config.contracts;

  const [isPending, setIsPending] = useState(false);
  const { writeContractAsync } = useWriteContract();

  const traderVaultAddress = deployments.SoothTraderVault as `0x${string}`;

  // 1. Fetch the EXACT collateral token that TraderVault expects (usually 'asset')
  const { data: vaultAsset } = useReadContract({
    address: traderVaultAddress,
    abi: TRADER_VAULT_V4_ABI,
    functionName: 'asset',
    query: {
      enabled: mode === 'real' && !!traderVaultAddress,
      staleTime: Infinity,
    },
  });

  // Use dynamic address, fallback to config only if loading/error
  const tokenAddress = (vaultAsset || deployments.MockUSDC) as `0x${string}`;

  // Balance Check - USDC Balance (of the CORRECT token)
  const { data: usdcBalance } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address || '0x0'],
    query: {
      enabled: mode === 'real' && !!address && !!tokenAddress,
    },
  });

  if (mode === 'real' && !usdcBalance && !tokenAddress) {
    // Keep minimal error logging if needed, or remove entire block if it was just for debug
  }

  // Fetch token decimals (of the CORRECT token)
  const { data: decimalsVal } = useReadContract({
    address: tokenAddress,
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
      refetchInterval: 3000,
    },
  });
  const traderVaultBalance = vaultAccounts?.[0]; // available balance

  // Deprecated: Approval not needed for V4 AMM trading
  // ... (Removed useReadContract for allowance and approve function)

  // Determine if approval is needed (Not for V4 AMM - uses Internal Vault)

  const trade = async (outcomeIndex: 0 | 1, shares: string, slippageBps: number = 50) => {
    setIsPending(true);
    try {
      if (!publicClient) throw new Error('Public client not found');
      if (!traderVaultAddress) throw new Error('TraderVault not configured for this chain');
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
      await refetchTraderVaultBalance();

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


      // 3. Runtime Guard: Validate market is registered
      console.log('Validating market registration...');
      const isValidMarket = await publicClient.readContract({
        address: traderVaultAddress,
        abi: TRADER_VAULT_V4_ABI,
        functionName: 'isMarket',
        args: [market.contractAddress as `0x${string}`],
      });

      if (!isValidMarket) {
        throw new Error(
          `Market ${market.contractAddress} is not registered in TraderVault. ` +
          `This usually means your config has stale addresses. Run: verify-deployment.sh`
        );
      }

      // 4. Execute Trade
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

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success') {
        toast.success('Trade successful!', { id: toastId });
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
    allowance: 0n, // Deprecated in V4 Hook
    approve: async () => true, // Deprecated
    balance: vaultAccounts?.[0] || 0n, // VAULT BALANCE
    walletBalance: usdcBalance || 0n, // Useful for Deposit hints
    decimals
  };
}
