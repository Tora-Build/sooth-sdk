import { useCallback, useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, usePublicClient, useChainId, useSwitchChain } from 'wagmi';
import { parseUnits, formatUnits, maxUint256 } from 'viem';
import { LAUNCHPAD_MARKET_ABI, ERC20_ABI, TRADER_VAULT_V4_ABI } from '../config/abis';
import { useChainStore } from '../store/useChainStore';
import { useActivityStore } from '../store/useActivityStore';
import { useDeployments } from './useDeployments';
import marketsConfig from '../config/markets.json';
import toast from 'react-hot-toast';

/**
 * V7: Integrated swap hook using TraderVault.depositAndTradeAMM
 * Bypasses direct market.swap (which is disabled in V7)
 * Still provides 1 approve + 1 trade UX
 */
export function useLaunchpadSwap(marketAddress?: `0x${string}`) {
    const { address: userAddress } = useAccount();
    const { selectedChainId } = useChainStore();
    const { config } = useDeployments();
    const traderVaultAddress = config.contracts.SoothTraderVault as `0x${string}`;
    const usdcAddressFromConfig = config.contracts.MockUSDC as `0x${string}`;

    const walletChainId = useChainId();
    const { switchChainAsync } = useSwitchChain();
    const publicClient = usePublicClient({ chainId: Number(selectedChainId) });
    const [isPending, setIsPending] = useState(false);
    const [isApproving, setIsApproving] = useState(false);

    // Get USDC address from market (fallback/verification)
    const { data: usdcAddressFromMarket } = useReadContract({
        address: marketAddress,
        abi: LAUNCHPAD_MARKET_ABI,
        functionName: 'asset',
        chainId: Number(selectedChainId),
        query: { 
            enabled: !!marketAddress,
        }
    });

    const usdcAddress = usdcAddressFromConfig || usdcAddressFromMarket;

    // Get USDC decimals
    const { data: usdcDecimals } = useReadContract({
        address: usdcAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'decimals',
        chainId: Number(selectedChainId),
        query: { 
            enabled: !!usdcAddress,
        }
    });

    // Get user's spendable USDC balance (Wallet + TraderVault)
    const { data: walletUsdcBalance, refetch: refetchWalletBalance } = useReadContract({
        address: usdcAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: userAddress ? [userAddress] : undefined,
        chainId: Number(selectedChainId),
        query: { 
            enabled: !!usdcAddress && !!userAddress,
        }
    });

    const { data: vaultAvailableBalance, refetch: refetchVaultBalance } = useReadContract({
        address: traderVaultAddress,
        abi: TRADER_VAULT_V4_ABI,
        functionName: 'availableBalance',
        args: userAddress ? [userAddress] : undefined,
        chainId: Number(selectedChainId),
        query: { 
            enabled: !!traderVaultAddress && !!userAddress,
        }
    });

    const totalSpendableBalance = (walletUsdcBalance as bigint || 0n) + (vaultAvailableBalance as bigint || 0n);

    // Get user's USDC allowance for TraderVault
    const { data: allowance, refetch: refetchAllowance } = useReadContract({
        address: usdcAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: userAddress && traderVaultAddress ? [userAddress, traderVaultAddress] : undefined,
        chainId: Number(selectedChainId),
        query: { 
            enabled: !!usdcAddress && !!userAddress && !!traderVaultAddress,
        }
    });

    const { writeContractAsync } = useWriteContract();

    const decimals = usdcDecimals !== undefined ? Number(usdcDecimals) : 6;
    const targetChainId = Number(selectedChainId);

    const refetchBalances = useCallback(async () => {
        await Promise.all([refetchWalletBalance(), refetchVaultBalance(), refetchAllowance()]);
    }, [refetchWalletBalance, refetchVaultBalance, refetchAllowance]);

    // MegaETH Frontier often requires explicit high gas to avoid flaky estimateGas behavior.
    const megaethGas = targetChainId === 4326 ? 999999999n : undefined;

    const ensureWalletOnSelectedChain = useCallback(async () => {
        if (!targetChainId) return false;
        if (walletChainId === targetChainId) return true;

        // Prompt a wallet switch (best effort), otherwise bail to avoid cross-chain tx spam.
        const toastId = toast.loading(`Switch wallet network to Chain ${targetChainId}...`);
        try {
            await switchChainAsync?.({ chainId: targetChainId });
            toast.dismiss(toastId);
            return true;
        } catch (e) {
            toast.error(`Please switch your wallet to Chain ${targetChainId} and try again.`, { id: toastId });
            return false;
        }
    }, [targetChainId, walletChainId, switchChainAsync]);

    /**
     * Approve USDC for TraderVault (one-time or per-trade)
     */
    const approve = useCallback(async (amount?: bigint) => {
        if (!traderVaultAddress) {
            toast.error('TraderVault address not found in config');
            return;
        }
        if (!usdcAddress) {
            toast.error('USDC address not ready (market query pending)');
            return;
        }
        if (!publicClient) {
            toast.error('Public client not ready');
            return;
        }
        if (!userAddress) {
            toast.error('Please connect your wallet');
            return;
        }

        const okChain = await ensureWalletOnSelectedChain();
        if (!okChain) return false;

        if (isApproving) return;
        setIsApproving(true);

        const toastId = toast.loading('Checking allowance...');
        try {
            const approveAmount = amount || maxUint256;

            // Fresh check before sending
            const currentAllowance = await publicClient.readContract({
                address: usdcAddress as `0x${string}`,
                abi: ERC20_ABI,
                functionName: 'allowance',
                args: [userAddress, traderVaultAddress]
            }) as bigint;

            if (currentAllowance >= (amount || 1n)) {
                toast.success('Already approved!', { id: toastId });
                setIsApproving(false); // Make sure to reset this!
                return true;
            }

            toast.loading('Approving USDC for Vault...', { id: toastId });
            const hash = await writeContractAsync({
                address: usdcAddress as `0x${string}`,
                abi: ERC20_ABI,
                functionName: 'approve',
                args: [traderVaultAddress, approveAmount],
                chainId: targetChainId,
                gas: megaethGas
            });

            await publicClient.waitForTransactionReceipt({ hash });
            
            toast.success('Approved!', { id: toastId });
            await refetchBalances();
            return true;
        } catch (error: any) {
            toast.error(error.message?.split('\n')[0] || 'Approval failed', { id: toastId });
            return false;
        } finally {
            setIsApproving(false);
        }
    }, [traderVaultAddress, usdcAddress, userAddress, writeContractAsync, publicClient, refetchBalances, isApproving, ensureWalletOnSelectedChain, targetChainId, megaethGas]);

    /**
     * Execute direct trade via TraderVault (safe path)
     * @param outcome 0 = YES, 1 = NO
     * @param shares Amount of shares (string, e.g., "10" for buy, "-10" for sell)
     * @param maxCostUsdc Max USDC to spend (for buys) or min to receive (for sells)
     */
    const swap = useCallback(async (
        outcome: 0 | 1,
        shares: string,
        maxCostUsdc: string
    ) => {
        if (!marketAddress) {
            toast.error('Market address missing');
            return;
        }
        if (!traderVaultAddress) {
            toast.error('TraderVault address missing');
            return;
        }
        if (!userAddress) {
            toast.error('Please connect your wallet');
            return;
        }
        if (!publicClient) {
            toast.error('Public client not ready');
            return;
        }

        const okChain = await ensureWalletOnSelectedChain();
        if (!okChain) return false;

        if (isPending || isApproving) return;
        setIsPending(true);
        const isBuy = !shares.startsWith('-');
        const absShares = shares.replace('-', '');

        try {
            // Convert to contract units
            const deltaShares = parseUnits(absShares, 18); // Shares are always 18 decimals
            const signedDelta = isBuy ? deltaShares : -deltaShares;
            const maxCost = parseUnits(maxCostUsdc, decimals);
            const signedMaxCost = isBuy ? maxCost : -maxCost;

            // Check and auto-approve for buys (approve unlimited for better UX)
            if (isBuy) {
                const currentAllowance = (allowance as bigint) || 0n;
                if (currentAllowance < maxCost) {
                    const approved = await approve();
                    if (!approved) {
                        setIsPending(false);
                        return;
                    }
                }
            }

            // Execute via TraderVault
            const toastId = toast.loading(isBuy ? 'Buying shares...' : 'Selling shares...');
            
            // Calculate deposit needed: maxCost - availableInVault
            const availableInVault = (vaultAvailableBalance as bigint) || 0n;
            const depositAmount = isBuy && maxCost > availableInVault ? maxCost - availableInVault : 0n;

            const hash = await writeContractAsync({
                address: traderVaultAddress,
                abi: TRADER_VAULT_V4_ABI,
                functionName: 'depositAndTradeAMM',
                args: [marketAddress, outcome, signedDelta, signedMaxCost, depositAmount],
                chainId: targetChainId,
                gas: megaethGas
            });

            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            if (receipt.status === 'success') {
                const action = isBuy ? 'Bought' : 'Sold';
                toast.success(`${action} ${absShares} ${outcome === 0 ? 'YES' : 'NO'} shares!`, { id: toastId });
                
                // Add to Activity Log
                const markets = Array.isArray(marketsConfig) ? marketsConfig : (marketsConfig as any).markets || [];
                const marketConfig = markets.find((m: any) =>
                    m.contractAddress?.toLowerCase() === marketAddress?.toLowerCase()
                );
                const marketName = marketConfig?.name || 'Launchpad Market';

                useActivityStore.getState().addActivity({
                    type: 'trade',
                    market: marketName,
                    description: `${action} ${parseFloat(absShares).toFixed(2)} ${outcome === 0 ? 'YES' : 'NO'} shares`,
                    hash: hash,
                    mode: 'real',
                    timestamp: Date.now(),
                    chainId: Number(selectedChainId),
                });

                // If it was a sell, add a lock activity too
                if (!isBuy) {
                    useActivityStore.getState().addActivity({
                        type: 'liquidity',
                        market: 'Trading Vault',
                        description: `Proceeds locked (24h): ${maxCostUsdc} USDC`,
                        hash: hash,
                        mode: 'real',
                        timestamp: Date.now() + 1, // Slight offset to keep order
                        chainId: Number(selectedChainId),
                    });
                }

                await refetchBalances();
                return true;
            } else {
                toast.error('Transaction failed', { id: toastId });
                return false;
            }
        } catch (error: any) {
            console.error('Swap error:', error);
            toast.error(error.message?.split('\n')[0] || 'Swap failed');
            return false;
        } finally {
            setIsPending(false);
        }
    }, [marketAddress, traderVaultAddress, userAddress, publicClient, decimals, allowance, vaultAvailableBalance, approve, writeContractAsync, refetchBalances, isPending, isApproving, ensureWalletOnSelectedChain, targetChainId, megaethGas]);

    /**
     * Claim unlocked proceeds from sells via TraderVault
     */
    const claimUnlocked = useCallback(async () => {
        if (!marketAddress) {
            toast.error('Market address missing');
            return;
        }
        if (!traderVaultAddress) {
            toast.error('TraderVault address missing');
            return;
        }
        if (!publicClient) {
            toast.error('Public client not ready');
            return;
        }

        const okChain = await ensureWalletOnSelectedChain();
        if (!okChain) return false;

        const toastId = toast.loading('Claiming unlocked proceeds...');
        try {
            const hash = await writeContractAsync({
                address: traderVaultAddress,
                abi: TRADER_VAULT_V4_ABI,
                functionName: 'claimUnlocked',
                args: [marketAddress],
                chainId: targetChainId,
                gas: megaethGas
            });

            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            
            if (receipt.status === 'success') {
                toast.success('Claimed!', { id: toastId });
                await refetchBalances();
                return true;
            } else {
                toast.error('Claim failed', { id: toastId });
                return false;
            }
        } catch (error: any) {
            toast.error(error.message?.split('\n')[0] || 'Claim failed', { id: toastId });
            return false;
        }
    }, [marketAddress, traderVaultAddress, publicClient, writeContractAsync, refetchBalances, ensureWalletOnSelectedChain, targetChainId, megaethGas]);

    const isLoading = !usdcAddress || !traderVaultAddress;

    return {
        swap,
        approve,
        claimUnlocked,
        isPending,
        isLoading,
        usdcBalance: totalSpendableBalance,
        allowance: (allowance as bigint) || 0n,
        decimals,
        refetch: refetchBalances
    };
}

