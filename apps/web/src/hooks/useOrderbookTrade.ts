import { useState } from 'react';
import { useAccount, useWriteContract, usePublicClient, useReadContract, useReadContracts } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { TRADER_VAULT_V4_ABI, ERC20_ABI } from '../config/abis';
import { useDeployments } from './useDeployments';
import { useAmmMarket } from './useAmmMarket';
import { useAmmMarketByAddress } from './useAmmMarketByAddress';
import toast from 'react-hot-toast';
import { useChainStore } from '../store/useChainStore';
import { getChainById } from '../lib/chains';
import { useMarketStore } from '../store/useMarketStore';

export function useOrderbookTrade(marketId: string) {
  const { address } = useAccount();

  // Detect if marketId is an address (0x...) or a config ID
  const isAddressFormat = marketId?.startsWith('0x') && marketId.length === 42;

  // Use useAmmMarketByAddress for dynamic V5 markets, useAmmMarket for config-based V4
  const { market: configMarket } = useAmmMarket(isAddressFormat ? '' : marketId);
  const { market: addressMarket } = useAmmMarketByAddress(
    isAddressFormat ? (marketId as `0x${string}`) : undefined
  );
  const market = isAddressFormat ? addressMarket : configMarket;

  // For address-format markets, use the marketId directly as the contract address
  const marketContractAddress = (isAddressFormat ? marketId : market?.contractAddress) as `0x${string}`;

  const { config } = useDeployments();
  const deployments = config.contracts;
  const { selectedChainId } = useChainStore();
  const publicClient = usePublicClient({ chainId: Number(selectedChainId) });
  const { mode } = useMarketStore();
  const { writeContractAsync } = useWriteContract();

  const [isPending, setIsPending] = useState(false);

  // v4: Use TraderVaultV4 as single entry point
  const traderVaultAddress = deployments.SoothTraderVault as `0x${string}`;

  // v4: Check accounts (available, pending) in TraderVaultV4
  const { data: vaultData, refetch: refetchBalance } = useReadContracts({
    contracts: [
      { address: traderVaultAddress, abi: TRADER_VAULT_V4_ABI, functionName: 'availableBalance', args: [address || '0x0'], chainId: Number(selectedChainId) },
      { address: traderVaultAddress, abi: TRADER_VAULT_V4_ABI, functionName: 'shareBalances', args: [address || '0x0', marketContractAddress as `0x${string}`, 0], chainId: Number(selectedChainId) },
      { address: traderVaultAddress, abi: TRADER_VAULT_V4_ABI, functionName: 'shareBalances', args: [address || '0x0', marketContractAddress as `0x${string}`, 1], chainId: Number(selectedChainId) },
      { address: deployments.MockUSDC as `0x${string}`, abi: ERC20_ABI, functionName: 'decimals', chainId: Number(selectedChainId) },
    ],
    query: {
      enabled: !!address && !!marketContractAddress && !!traderVaultAddress,
      refetchInterval: 3000,
    },
  });

  const rawBalance = vaultData?.[0]?.result as bigint || 0n;
  const internalYesShares = vaultData?.[1]?.result as bigint || 0n;
  const internalNoShares = vaultData?.[2]?.result as bigint || 0n;
  const decimals = Number(vaultData?.[3]?.result || 18);

  // Normalize balance to 18 decimals for consistent frontend comparison
  const availableBalance = decimals === 18 ? rawBalance : rawBalance * BigInt(10 ** (18 - decimals));




  const placeOrder = async (outcome: 0 | 1, price: string, amount: string, isBuy: boolean = true) => {
    setIsPending(true);
    try {
      const chain = publicClient?.chain;
      if (chain?.id !== selectedChainId) {
        const targetChain = getChainById(selectedChainId);
        throw new Error(`Please switch to ${targetChain?.name || 'the correct network'}`);
      }

      if (!marketContractAddress) throw new Error('Market not found');

      const priceBig = parseUnits(price, 18);
      const amountBig = parseUnits(amount, 18); // V4: WAD Granularity

      const ONE = parseUnits('1', 18);

      // Calculate collateral (Frontend Check)
      let collateralRequired: bigint;
      if (isBuy) {
        collateralRequired = (priceBig * amountBig) / ONE;
      } else {
        collateralRequired = ((ONE - priceBig) * amountBig) / ONE;
      }

      console.log('Placing Limit Order:', { outcome, isBuy, price, amount, collateralRequired: collateralRequired.toString() });

      if (mode === 'demo') {
        await new Promise(r => setTimeout(r, 1000));
        toast.success(`Demo: Placed ${isBuy ? 'Buy' : 'Sell'} Limit Order`);
        setIsPending(false);
        return;
      }

      // Check available balance (Frontend Check)
      const { data: latestData } = await refetchBalance();
      const rawBalanceLatest = (latestData?.[0]?.result as bigint) || 0n;
      const latestDecimals = Number(latestData?.[3]?.result || 18);
      const balance = latestDecimals === 18 ? rawBalanceLatest : rawBalanceLatest * BigInt(10 ** (18 - latestDecimals));

      if (balance < collateralRequired) {
        throw new Error(`Insufficient balance. Need ${(Number(collateralRequired) / 1e18).toFixed(2)} USDC, have ${(Number(balance) / 1e18).toFixed(2)} USDC.`);
      }

      // SIMULATE first to catch revert reasons
      if (publicClient) {
        try {
          await publicClient.simulateContract({
            account: address,
            address: traderVaultAddress,
            abi: TRADER_VAULT_V4_ABI,
            functionName: 'placeOrder',
            args: [marketContractAddress, outcome, priceBig, amountBig, isBuy],
          });
        } catch (simError: any) {
          console.error('Simulation Failed:', simError);
          
          // Detect RPC resource errors (common on MegaETH)
          if (simError.message?.includes('Requested resource not available')) {
             throw new Error('MegaETH RPC is temporarily busy. Please wait a few seconds and try again.');
          }

          const reason = simError.reason || simError.shortMessage || simError.message || 'Transaction would fail';
          throw new Error(`Simulation failed: ${reason}`);
        }
      }

      // v4: Place order
      const hash = await writeContractAsync({
        address: traderVaultAddress,
        abi: TRADER_VAULT_V4_ABI,
        functionName: 'placeOrder',
        args: [marketContractAddress, outcome, priceBig, amountBig, isBuy],
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
      if (!marketContractAddress) throw new Error('Market not found');

      const priceBig = parseUnits(price, 18);
      const amountBig = parseUnits(amount, 18);

      console.log('Placing Spot Order:', { outcome, price, amount });

      if (mode === 'demo') {
        await new Promise(r => setTimeout(r, 1000));
        toast.success(`Demo: Placed Spot Sell Order`);
        setIsPending(false);
        return;
      }

      // Check INTERNAL SHARE balance
      const shareBalance = outcome === 0 ? internalYesShares : internalNoShares;
      if (amountBig > shareBalance) {
        throw new Error(`Insufficient internal shares. Have ${formatUnits(shareBalance, 18)}, trying to sell ${amount}. Info: Spot sell requires shares in Vault.`);
      }

      const hash = await writeContractAsync({
        address: traderVaultAddress,
        abi: TRADER_VAULT_V4_ABI,
        functionName: 'placeSpotOrder',
        args: [marketContractAddress, outcome, priceBig, amountBig],
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

  /**
   * Execute Hybrid Sell in a SINGLE transaction.
   * The contract automatically splits between:
   * - Spot Sell (using custodial shares)
   * - Short Sell (using USDC collateral)
   */
  const executeHybridSell = async (outcome: 0 | 1, price: string, amount: string) => {
    setIsPending(true);
    try {
      const chain = publicClient?.chain;
      if (chain?.id !== selectedChainId) throw new Error('Wrong Network');
      if (!marketContractAddress) throw new Error('Market not found');

      const priceBig = parseUnits(price, 18);
      const amountBig = parseUnits(amount, 18);

      console.log('Executing Hybrid Sell:', { outcome, price, amount });

      if (mode === 'demo') {
        await new Promise(r => setTimeout(r, 1000));
        toast.success(`Demo: Hybrid Sell executed`);
        setIsPending(false);
        return;
      }

      // Estimate gas with 1.5x multiplier for matching gas
      let gasEstimate: bigint | undefined;
      if (publicClient) {
        try {
          gasEstimate = await publicClient.estimateContractGas({
            account: address,
            address: traderVaultAddress,
            abi: TRADER_VAULT_V4_ABI,
            functionName: 'executeHybridSell',
            args: [marketContractAddress, outcome, priceBig, amountBig],
          });
          gasEstimate = (gasEstimate * 150n) / 100n; // 1.5x multiplier
        } catch (e) {
          console.warn('Gas estimation failed, using default');
        }
      }

      const hash = await writeContractAsync({
        address: traderVaultAddress,
        abi: TRADER_VAULT_V4_ABI,
        functionName: 'executeHybridSell',
        args: [marketContractAddress, outcome, priceBig, amountBig],
        gas: gasEstimate,
      });

      const toastId = toast.loading('Executing Hybrid Sell...');

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
        toast.success('Hybrid Sell Executed!', { id: toastId });
      }

    } catch (err: any) {
      console.error('Hybrid Sell Error:', err);
      toast.error(err.message || 'Failed to execute hybrid sell');
    } finally {
      setIsPending(false);
    }
  };

  const cancelOrder = async (orderId: string) => {
    setIsPending(true);
    try {
      if (!marketContractAddress) throw new Error('Market not found');

      // v4: Cancel order through TraderVaultV4
      const hash = await writeContractAsync({
        address: traderVaultAddress,
        abi: TRADER_VAULT_V4_ABI,
        functionName: 'cancelOrder',
        args: [marketContractAddress, BigInt(orderId)],
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

      if (!marketContractAddress) throw new Error('Market not found');

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
        const { data: latestData } = await refetchBalance();
        const rawBalanceLatest = (latestData?.[0]?.result as bigint) || 0n;
        const latestDecimals = Number(latestData?.[3]?.result || 18);
        const balance = latestDecimals === 18 ? rawBalanceLatest : rawBalanceLatest * BigInt(10 ** (18 - latestDecimals));
        
        if (balance < limitValue) {
          throw new Error(`Insufficient balance. Need ${(Number(limitValue) / 1e18).toFixed(2)} USDC, have ${(Number(balance) / 1e18).toFixed(2)} USDC.`);
        }
      } else {
        // v3: Check holdngs for Sells
        // Note: strict check might fail if data is stale, but better than revert on-chain
        const userShares = market ? (outcome === 0 ? market.userYesShares : market.userNoShares) : 0;
        if (Number(amount) > (userShares || 0)) {
          throw new Error(`Insufficient shares. Have ${userShares?.toFixed(2)}, trying to sell ${amount}`);
        }
      }

      // v4: Execute taker order through TraderVaultV4.tradeAMM
      const hash = await writeContractAsync({
        address: traderVaultAddress,
        abi: TRADER_VAULT_V4_ABI,
        functionName: 'tradeAMM',
        args: [marketContractAddress, outcome, sharesWad, costSigned],
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

  const depositShares = async (outcome: number, amount: string) => {
    setIsPending(true);
    try {
      if (!marketContractAddress) throw new Error('Market not found');
      const amountBig = parseUnits(amount, 18);
      const hash = await writeContractAsync({
        address: traderVaultAddress,
        abi: TRADER_VAULT_V4_ABI,
        functionName: 'depositShares',
        args: [marketContractAddress, outcome, amountBig],
      });
      const toastId = toast.loading('Depositing shares...');
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
        toast.success('Shares deposited!', { id: toastId });
        refetchBalance();
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Deposit failed');
    } finally {
      setIsPending(false);
    }
  };

  return {
    placeOrder,
    placeSpotOrder,
    executeHybridSell,
    cancelOrder,
    executeTakerOrder,
    depositShares,
    isPending,
    availableBalance: (availableBalance as bigint || 0n),
    internalYesShares,
    internalNoShares,
    refetchBalance
  };
}
