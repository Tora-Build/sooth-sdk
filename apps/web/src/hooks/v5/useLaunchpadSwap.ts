import { useCallback, useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, usePublicClient } from 'wagmi';
import { parseUnits, formatUnits, maxUint256 } from 'viem';
import { LAUNCHPAD_MARKET_ABI, ERC20_ABI } from '../../config/abis';
import toast from 'react-hot-toast';

/**
 * V6.1: Direct swap hook for Launchpad markets
 * Bypasses TraderVault - user interacts directly with market contract
 * Reduces transactions: 1 approve + 1 swap (vs 3 txs via TraderVault)
 */
export function useLaunchpadSwap(marketAddress?: `0x${string}`) {
    const { address: userAddress } = useAccount();
    const publicClient = usePublicClient();
    const [isPending, setIsPending] = useState(false);
    const [isApproving, setIsApproving] = useState(false);

    // Get USDC address from market
    const { data: usdcAddress } = useReadContract({
        address: marketAddress,
        abi: LAUNCHPAD_MARKET_ABI,
        functionName: 'asset',
        query: { enabled: !!marketAddress }
    });

    // Get USDC decimals
    const { data: usdcDecimals } = useReadContract({
        address: usdcAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'decimals',
        query: { enabled: !!usdcAddress }
    });

    // Get user's USDC balance
    const { data: usdcBalance, refetch: refetchBalance } = useReadContract({
        address: usdcAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: userAddress ? [userAddress] : undefined,
        query: { enabled: !!usdcAddress && !!userAddress }
    });

    // Get user's USDC allowance for market
    const { data: allowance, refetch: refetchAllowance } = useReadContract({
        address: usdcAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: userAddress && marketAddress ? [userAddress, marketAddress] : undefined,
        query: { enabled: !!usdcAddress && !!userAddress && !!marketAddress }
    });

    const { writeContractAsync } = useWriteContract();

    const decimals = Number(usdcDecimals || 6);

    /**
     * Approve USDC for market (one-time or per-trade)
     */
    const approve = useCallback(async (amount?: bigint) => {
        if (!marketAddress || !usdcAddress || !publicClient || !userAddress) {
            toast.error('Market not ready');
            return;
        }

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
                args: [userAddress, marketAddress]
            }) as bigint;

            if (currentAllowance >= (amount || 1n)) {
                toast.success('Already approved!', { id: toastId });
                setIsApproving(false); // Make sure to reset this!
                return true;
            }

            toast.loading('Approving USDC...', { id: toastId });
            const hash = await writeContractAsync({
                address: usdcAddress as `0x${string}`,
                abi: ERC20_ABI,
                functionName: 'approve',
                args: [marketAddress, approveAmount]
            });

            await publicClient.waitForTransactionReceipt({ hash });
            
            toast.success('Approved!', { id: toastId });
            await refetchAllowance();
            return true;
        } catch (error: any) {
            toast.error(error.message?.split('\n')[0] || 'Approval failed', { id: toastId });
            return false;
        } finally {
            setIsApproving(false);
        }
    }, [marketAddress, usdcAddress, userAddress, writeContractAsync, publicClient, refetchAllowance, isApproving]);

    /**
     * Execute direct swap on market
     * @param outcome 0 = YES, 1 = NO
     * @param shares Amount of shares (string, e.g., "10" for buy, "-10" for sell)
     * @param maxCostUsdc Max USDC to spend (for buys) or min to receive (for sells)
     */
    const swap = useCallback(async (
        outcome: 0 | 1,
        shares: string,
        maxCostUsdc: string
    ) => {
        if (!marketAddress || !userAddress || !publicClient) {
            toast.error('Wallet not connected');
            return;
        }

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

            // Execute swap
            const toastId = toast.loading(isBuy ? 'Buying shares...' : 'Selling shares...');
            
            const hash = await writeContractAsync({
                address: marketAddress,
                abi: LAUNCHPAD_MARKET_ABI,
                functionName: 'swap',
                args: [outcome, signedDelta, signedMaxCost]
            });

            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            if (receipt.status === 'success') {
                const action = isBuy ? 'Bought' : 'Sold';
                toast.success(`${action} ${absShares} ${outcome === 0 ? 'YES' : 'NO'} shares!`, { id: toastId });
                await refetchBalance();
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
    }, [marketAddress, userAddress, publicClient, decimals, allowance, approve, writeContractAsync, refetchBalance, isPending, isApproving]);

    /**
     * Claim unlocked proceeds from sells
     */
    const claimUnlocked = useCallback(async () => {
        if (!marketAddress || !publicClient) {
            toast.error('Market not ready');
            return;
        }

        const toastId = toast.loading('Claiming unlocked proceeds...');
        try {
            const hash = await writeContractAsync({
                address: marketAddress,
                abi: LAUNCHPAD_MARKET_ABI,
                functionName: 'claimUnlocked'
            });

            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            
            if (receipt.status === 'success') {
                toast.success('Claimed!', { id: toastId });
                await refetchBalance();
                return true;
            } else {
                toast.error('Claim failed', { id: toastId });
                return false;
            }
        } catch (error: any) {
            toast.error(error.message?.split('\n')[0] || 'Claim failed', { id: toastId });
            return false;
        }
    }, [marketAddress, publicClient, writeContractAsync, refetchBalance]);

    return {
        swap,
        approve,
        claimUnlocked,
        isPending,
        usdcBalance: (usdcBalance as bigint) || 0n,
        allowance: (allowance as bigint) || 0n,
        decimals,
        refetch: refetchBalance
    };
}
