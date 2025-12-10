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



  const placeOrder = async (outcome: 0 | 1, price: string, amount: string, isBuy: boolean = true) => {
    setIsPending(true);
    try {
      const chain = publicClient?.chain;
      if (chain?.id !== selectedChainId) {
        const targetChain = getChainById(selectedChainId);
        throw new Error(`Please switch to ${targetChain?.name || 'the correct network'}`);
      }

      if (!market?.contractAddress) throw new Error('Market not found');

      const priceBig = parseUnits(price, 18);

      // V4: Limit Order Amount is INTEGER (decimals=0)
      // Ensure we parse as BigInt directly, assuming whole numbers
      if (!/^\d+$/.test(amount)) {
        throw new Error('Limit orders require integer amounts (no decimals)');
      }
      const amountBig = BigInt(amount);

      const ONE = parseUnits('1', 18);

      // Calculate required collateral:
      // Price is WAD (18 decimals). Amount is Integer (0 decimals).
      // Collateral = Price * Amount
      // Example: Price 0.60 (0.6e18) * 10 Shares = 6e18 (6 USDC)

      let collateralRequired: bigint;

      if (isBuy) {
        collateralRequired = priceBig * amountBig;
      } else {
        // Short Sell: Collateral is (1 - Price) * Amount
        // (1e18 - 0.6e18) * 10 = 0.4e18 * 10 = 4e18 (4 USDC)
        collateralRequired = (ONE - priceBig) * amountBig;
      }

      console.log('Placing Limit Order:', {
        outcome,
        isBuy,
        price,
        amount,
        collateralRequired: collateralRequired.toString()
      });

      if (mode === 'demo') {
        await new Promise(r => setTimeout(r, 1000));
        toast.success(`Demo: Placed ${isBuy ? 'Buy' : 'Sell'} Limit Order`);
        setIsPending(false);
        return;
      }

      // Check available balance in TraderVault
      const { data: latestBalance } = await refetchBalance();
      const balance = (latestBalance || availableBalance) as bigint || 0n;

      if (balance < collateralRequired) {
        throw new Error(`Insufficient balance. Need ${(Number(collateralRequired) / 1e18).toFixed(2)} USDC, have ${(Number(balance) / 1e18).toFixed(2)} USDC.`);
      }

      // v4: Place order through TraderVaultV4
      // placeOrder(market, outcome, price, amount, isBuy)
      const hash = await writeContractAsync({
        address: traderVaultAddress,
        abi: TRADER_VAULT_V4_ABI,
        functionName: 'placeOrder',
        args: [market.contractAddress as `0x${string}`, outcome, priceBig, amountBig, isBuy],
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

  const placeSpotOrder = async (outcome: 0 | 1, price: string, amount: string) => {
    setIsPending(true);
    try {
      const chain = publicClient?.chain;
      if (chain?.id !== selectedChainId) throw new Error('Wrong Network');
      if (!market?.contractAddress) throw new Error('Market not found');

      const priceBig = parseUnits(price, 18);

      if (!/^\d+$/.test(amount)) throw new Error('Integer amounts only');
      const amountBig = BigInt(amount);

      console.log('Placing Spot Order:', { outcome, price, amount });

      if (mode === 'demo') {
        await new Promise(r => setTimeout(r, 1000));
        toast.success(`Demo: Placed Spot Sell Order`);
        setIsPending(false);
        return;
      }

      // Check SHARE balance (not USDC)
      const shareBalance = outcome === 0 ? market.userYesShares : market.userNoShares;
      if (Number(amount) > (shareBalance || 0)) {
        throw new Error(`Insufficient shares. Have ${shareBalance}, trying to sell ${amount}`);
      }

      const hash = await writeContractAsync({
        address: traderVaultAddress,
        abi: TRADER_VAULT_V4_ABI,
        functionName: 'placeSpotOrder',
        args: [market.contractAddress as `0x${string}`, outcome, priceBig, amountBig],
      });

      const toastId = toast.loading('Placing Spot Order...');

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
        toast.success('Spot Order Placed!', { id: toastId });
      }

    } catch (err: any) {
      console.error('Place Spot Order Error:', err);
      toast.error(err.message || 'Failed to place spot order');
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

      // V4: Amount is Integer
      if (!/^\d+$/.test(amount)) throw new Error('Amount must be integer');
      const amountBig = BigInt(amount);

      // Calculate maxCost (Limit Value)
      // Price (WAD) * Amount (Int) = Value (WAD)
      const limitValue = priceBig * amountBig;

      // Shares: Positive for Buy, Negative for Sell
      // SCALE TO WAD: tradeAMM expects WAD shares
      const sharesWad = isBuy ? amountBig * 1000000000000000000n : -(amountBig * 1000000000000000000n);

      // Limit Cost: Positive for Buy (Max Input), Negative for Sell (Min Output)
      const costSigned = isBuy ? limitValue : -limitValue;

      if (mode === 'demo') {
        await new Promise(r => setTimeout(r, 1000));
        toast.success(`Demo: Executed ${isBuy ? 'Buy' : 'Sell'} Order`);
        setIsPending(false);
        return;
      }

      console.log('Executing Taker Order:', {
        outcome,
        isBuy,
        sharesWad: sharesWad.toString(),
        costSigned: costSigned.toString()
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

      // v4: Execute taker order through TraderVaultV4.tradeAMM
      const hash = await writeContractAsync({
        address: traderVaultAddress,
        abi: TRADER_VAULT_V4_ABI,
        functionName: 'tradeAMM',
        args: [market.contractAddress as `0x${string}`, outcome, sharesWad, costSigned],
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
    placeSpotOrder,
    cancelOrder,
    executeTakerOrder,
    isPending,
    availableBalance: (availableBalance as bigint || 0n),
    refetchBalance
  };
}
