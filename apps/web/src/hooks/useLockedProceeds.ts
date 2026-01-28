import { useReadContracts, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi';
import { LAUNCHPAD_MARKET_ABI, TRADER_VAULT_V4_ABI } from '../config/abis';
import { useAccount } from 'wagmi';
import { useCallback } from 'react';
import { useDeployments } from './useDeployments';
import { getPollingInterval } from '../lib/polling';

/**
 * Hook for managing locked proceeds in V6 Launchpad markets
 * Locked proceeds can be used for reinvestment or claimed after 24h
 */
export function useLockedProceeds(marketAddress?: `0x${string}`) {
    const chainId = useChainId();
    const { address: userAddress } = useAccount();
    const { config } = useDeployments();
    const traderVaultAddress = config?.contracts?.SoothTraderVault as `0x${string}` | undefined;

    const { data: lockedData, refetch } = useReadContracts({
        contracts: [
            { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'lockedProceeds', args: userAddress ? [userAddress] : undefined },
            { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'totalLockedProceeds' },
        ],
        query: {
            enabled: !!marketAddress && !!userAddress,
            refetchInterval: getPollingInterval(chainId, 'fast')
        }
    });

    const [userLocked, totalLocked] = lockedData?.map(r => r.result) || [];

    // Write: Claim unlocked proceeds (via TraderVault)
    const { writeContract: claimWrite, data: claimTxHash, isPending: isClaimPending } = useWriteContract();
    const { isLoading: isClaimConfirming, isSuccess: isClaimConfirmed } = useWaitForTransactionReceipt({
        hash: claimTxHash,
    });

    const claimUnlocked = useCallback(() => {
        if (!marketAddress || !traderVaultAddress) return;
        // For Launchpad markets, we need to pass the market as the vault
        // Since market implements ISoothLiquidityVault
        claimWrite({
            address: traderVaultAddress,
            abi: TRADER_VAULT_V4_ABI,
            functionName: 'claimUnlocked',
            args: [marketAddress] // Pass market as ISoothLiquidityVault
        });
    }, [marketAddress, traderVaultAddress, claimWrite]);

    // Note: useLockedProceeds is handled automatically by TraderVault.tradeAMM
    // when buying from a bonding Launchpad market

    return {
        // Data
        userLocked: userLocked as bigint | undefined,
        totalLocked: totalLocked as bigint | undefined,
        
        // Actions
        claimUnlocked,
        
        // Loading/Tx States
        isClaimPending: isClaimPending || isClaimConfirming,
        claimTxHash,
        isClaimConfirmed,
        
        refetch
    };
}
