import { useState } from 'react';
import { useAccount, useWriteContract, usePublicClient, useReadContract } from 'wagmi';
import { parseUnits } from 'viem';
import { TRADER_VAULT_V4_ABI } from '../config/abis';
import { useDeployments } from './useDeployments';
import { useMarket } from './useMarket';
import toast from 'react-hot-toast';
import { useChainStore } from '../store/useChainStore';
import { getChainById } from '../lib/chains';
import { useMarketStore } from '../store/useMarketStore';

export function useLimitOrder(marketId: string) {
  const { address } = useAccount();
  const { market } = useMarket(marketId);
  const deployments = useDeployments();
  const publicClient = usePublicClient();
  const { selectedChainId } = useChainStore();
  const { mode } = useMarketStore();
  const { writeContractAsync } = useWriteContract();

  const [isPending, setIsPending] = useState(false);

  // v4: Use TraderVaultV4 as single entry point
  const traderVaultAddress = deployments.SoothTraderVault as `0x${string}`;

  // v4: Check accounts (available, pending) in TraderVaultV4
  const { data: vaultAccounts, refetch: refetchBalance } = useReadContract({
    address: traderVaultAddress,
    abi: TRADER_VAULT_V4_ABI,
    functionName: 'accounts',
    args: [address || '0x0'],
    query: {
      enabled: !!address,
      refetchInterval: 30000,
    },
  });
  const availableBalance = vaultAccounts?.[0]; // available balance



  const placeOrder = async (outcome: 0 | 1, price: string, amount: string) => {
    setIsPending(true);
    try {
      const chain = publicClient?.chain;
      if (chain?.id !== selectedChainId) {
        const targetChain = getChainById(selectedChainId);
        throw new Error(`Please switch to ${targetChain?.name || 'the correct network'}`);
      }

      if (!market?.contractAddress) throw new Error('Market not found');

      const priceBig = parseUnits(price, 18);
      const amountBig = parseUnits(amount, 18);

      const ONE = parseUnits('1', 18);
      // Calculate required collateral:
      // For placing a limit order, collateral = price * amount (you pay upfront)
      const collateralRequired = priceBig * amountBig / ONE;

      console.log('Placing Order:', {
        outcome,
        price,
        amount,
        collateralRequired: collateralRequired.toString()
      });

      if (mode === 'demo') {
        await new Promise(r => setTimeout(r, 1000));
        toast.success(`Demo: Placed Limit Order for ${amount} shares`);
        setIsPending(false);
        return;
      }

      // v3: Check available balance in TraderVault
      const { data: latestBalance } = await refetchBalance();
      const balance = (latestBalance || availableBalance) as bigint || 0n;

      console.log('--- Limit Order Balance Check ---');
      console.log('Vault Balance:', balance.toString());
      console.log('Required Collateral:', collateralRequired.toString());
      console.log('Price:', price);
      console.log('Amount:', amount);
      console.log('-------------------------------');

      if (balance < collateralRequired) {
        throw new Error(`Insufficient balance. Need ${(Number(collateralRequired) / 1e18).toFixed(2)} USDC, have ${(Number(balance) / 1e18).toFixed(2)} USDC. Please deposit more funds.`);
      }

      // v4: Place order through TraderVaultV4
      const hash = await writeContractAsync({
        address: traderVaultAddress,
        abi: TRADER_VAULT_V4_ABI,
        functionName: 'placeOrder',
        args: [market.contractAddress as `0x${string}`, outcome, priceBig, amountBig],
        gas: 300000n, // Explicit gas limit
      });

      const toastId = toast.loading('Placing Order...');

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
        toast.success('Order Placed!', { id: toastId });
      }

    } catch (err: any) {
      console.error('Place Order Error:', err);
      toast.error(err.message || 'Failed to place order');
    } finally {
      setIsPending(false);
    }
  };

  const cancelOrder = async (orderId: string) => {
    setIsPending(true);
    try {
      if (!market?.contractAddress) throw new Error('Market not found');

      // v4: Cancel order through TraderVaultV4
      const hash = await writeContractAsync({
        address: traderVaultAddress,
        abi: TRADER_VAULT_V4_ABI,
        functionName: 'cancelOrder',
        args: [market.contractAddress as `0x${string}`, BigInt(orderId)],
        gas: 200000n, // Explicit gas limit
      });

      const toastId = toast.loading('Cancelling Order...');

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
        toast.success('Order Cancelled!', { id: toastId });
      }

    } catch (err: any) {
      console.error('Cancel Order Error:', err);
      toast.error(err.message || 'Failed to cancel order');
    } finally {
      setIsPending(false);
    }
  };

  const executeTakerOrder = async (outcome: 0 | 1, price: string, amount: string, isBuy: boolean) => {
    setIsPending(true);
    try {
      const chain = publicClient?.chain;
      if (chain?.id !== selectedChainId) {
        const targetChain = getChainById(selectedChainId);
        throw new Error(`Please switch to ${targetChain?.name || 'the correct network'}`);
      }

      if (!market?.contractAddress) throw new Error('Market not found');

      const priceBig = parseUnits(price, 18);
      const amountBig = parseUnits(amount, 18);

      // Calculate maxCost (Limit Value)
      // For Buy: Max amount of USDC willing to pay = price * amount
      // For Sell: Min amount of USDC willing to receive = price * amount
      const ONE = parseUnits('1', 18);
      const limitValue = priceBig * amountBig / ONE;

      // Shares: Positive for Buy, Negative for Sell
      const shares = isBuy ? amountBig : -amountBig;

      if (mode === 'demo') {
        await new Promise(r => setTimeout(r, 1000));
        toast.success(`Demo: Executed ${isBuy ? 'Buy' : 'Sell'} Order`);
        setIsPending(false);
        return;
      }

      console.log('Executing Taker Order:', {
        outcome,
        isBuy,
        shares: shares.toString(),
        limitValue: limitValue.toString()
      });

      // v3: Check available balance for Buys
      if (isBuy) {
        const { data: latestBalance } = await refetchBalance();
        const balance = (latestBalance || availableBalance) as bigint || 0n;
        if (balance < limitValue) {
          throw new Error(`Insufficient balance. Need ${(Number(limitValue) / 1e18).toFixed(2)} USDC, have ${(Number(balance) / 1e18).toFixed(2)} USDC.`);
        }
      } else {
        // v3: Check holdngs for Sells
        // Note: strict check might fail if data is stale, but better than revert on-chain
        const userShares = outcome === 0 ? market.userYesShares : market.userNoShares;
        if (Number(amount) > (userShares || 0)) {
          throw new Error(`Insufficient shares. Have ${userShares?.toFixed(2)}, trying to sell ${amount}`);
        }
      }

      // v3: Execute taker order through TraderVaultV3.tradeAMM
      const hash = await writeContractAsync({
        address: traderVaultAddress,
        abi: TRADER_VAULT_V4_ABI,
        functionName: 'executeAMMTrade',
        // In V4: market, outcomeIdx, shares, maxCost, isBuy
        // Here we are filling a limit order via AMM? Or is this actually just a taker trade?
        // If this is 'executeAMMTrade', looking at V3 'tradeAMM' usage:
        // V3: market, outcome, deltaWad (shares), maxCostWad
        // V4: market, outcome, shares, limit, isBuy
        // We need to determine isBuy. shares > 0 is buy.
        args: [market.contractAddress as `0x${string}`, outcome, shares, limitValue, true],
      });

      const toastId = toast.loading('Executing Trade...');

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
        toast.success('Trade Executed!', { id: toastId });
      }

    } catch (err: any) {
      console.error('Taker Order Error:', err);
      toast.error(err.message || 'Failed to execute trade');
    } finally {
      setIsPending(false);
    }
  };

  return {
    placeOrder,
    cancelOrder,
    executeTakerOrder,
    isPending,
    availableBalance: (availableBalance as bigint || 0n),
    refetchBalance
  };
}
