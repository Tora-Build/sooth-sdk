// useAmmMarketByAddress.ts - Hook to fetch market data directly from contract address
// Used for dynamic V5 Launchpad markets that aren't in the static config

import React from 'react';
import { useReadContracts, useAccount, useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { MARKET_V4_ABI, TRADER_VAULT_V4_ABI, LAUNCHPAD_MARKET_ABI, LAUNCHPAD_OUTCOME_TOKEN_ABI } from '../config/abis';
import { useDeployments } from './useDeployments';
import { useChainStore } from '../store/useChainStore';
import { Market } from '../types';

export interface DynamicMarketData {
    address: `0x${string}`;
    name?: string;
    symbol?: string;
    isGraduated?: boolean;
    deadline?: number;
}

export function useAmmMarketByAddress(marketAddress?: `0x${string}`, marketMeta?: DynamicMarketData) {
    const { address: userAddress } = useAccount();
    const { config } = useDeployments();
    const { selectedChainId } = useChainStore();
    const chainId = Number(selectedChainId);
    const traderVaultAddress = config?.contracts?.SoothTraderVault as `0x${string}`;

    // 1. Fetch outcome token address first (Dependency for balances)
    const { data: outcomeTokenAddr } = useReadContract({
        address: marketAddress,
        abi: LAUNCHPAD_MARKET_ABI,
        functionName: 'outcomeToken',
        chainId: Number(selectedChainId),
        query: { enabled: !!marketAddress }
    });

    // 2. Fetch on-chain market data & All balance types (Vault vs Wallet)
    const { data: onChainData, refetch, isLoading } = useReadContracts({
        contracts: [
            { address: marketAddress, abi: MARKET_V4_ABI, functionName: 'isLive', chainId: Number(selectedChainId) },
            { address: marketAddress, abi: MARKET_V4_ABI, functionName: 'isSettled', chainId: Number(selectedChainId) },
            { address: marketAddress, abi: MARKET_V4_ABI, functionName: 'b', chainId: Number(selectedChainId) },
            { address: marketAddress, abi: MARKET_V4_ABI, functionName: 'qYes', chainId: Number(selectedChainId) },
            { address: marketAddress, abi: MARKET_V4_ABI, functionName: 'qNo', chainId: Number(selectedChainId) },
            { address: marketAddress, abi: MARKET_V4_ABI, functionName: 'feeLMSR', chainId: Number(selectedChainId) },
            // Wallet positions (ERC1155) - AMM IS WALLET ONLY
            {
                address: outcomeTokenAddr as `0x${string}`,
                abi: LAUNCHPAD_OUTCOME_TOKEN_ABI,
                functionName: 'balanceOf',
                args: [userAddress || '0x0000000000000000000000000000000000000000', 0n], // YES
                chainId: Number(selectedChainId)
            },
            {
                address: outcomeTokenAddr as `0x${string}`,
                abi: LAUNCHPAD_OUTCOME_TOKEN_ABI,
                functionName: 'balanceOf',
                args: [userAddress || '0x0000000000000000000000000000000000000000', 1n], // NO
                chainId: Number(selectedChainId)
            },
            // Orderbook YES (Liquid in Vault)
            {
                address: traderVaultAddress,
                abi: TRADER_VAULT_V4_ABI,
                functionName: 'shareBalances',
                args: [userAddress || '0x0', marketAddress || '0x0', 0], // YES
                chainId: Number(selectedChainId)
            },
            // Orderbook NO (Liquid in Vault)
            {
                address: traderVaultAddress,
                abi: TRADER_VAULT_V4_ABI,
                functionName: 'shareBalances',
                args: [userAddress || '0x0', marketAddress || '0x0', 1], // NO
                chainId: Number(selectedChainId)
            },
            // AMM Positions (Locked in Vault - Legacy)
            {
                address: traderVaultAddress,
                abi: TRADER_VAULT_V4_ABI,
                functionName: 'ammPositions',
                args: [userAddress || '0x0', marketAddress || '0x0'],
                chainId: Number(selectedChainId)
            }
        ],
        query: {
            enabled: !!marketAddress && !!outcomeTokenAddr && !!traderVaultAddress,
            // MegaETH RPCs are rate-limited; avoid aggressive polling that can break tx sends in wallets.
            refetchInterval: chainId === 4326 ? 20000 : 5000,
        }
    });

    const results = onChainData?.map(r => r.result) || [];
    const [isLive, isSettled, bParam, qYes, qNo, feeData, walletYes, walletNo, liqYes, liqNo, ammPos] = results;

    // Extract AMM position (TraderVault - legacy locked positions)
    const ammPosTyped = ammPos as [bigint, bigint] | undefined;
    const lockYes = ammPosTyped?.[0] || 0n;
    const lockNo = ammPosTyped?.[1] || 0n;
    
    // Extract Orderbook balances (TraderVault - liquid positions)
    const liquidYes = (liqYes as bigint) || 0n;
    const liquidNo = (liqNo as bigint) || 0n;

    // Extract Wallet balances (AMM is wallet only)
    const walletYesShares = (walletYes as bigint) || 0n;
    const walletNoShares = (walletNo as bigint) || 0n;

    const market: Market | undefined = React.useMemo(() => {
        if (!marketAddress) return undefined;

        // V6.2.5: Calculate prices on frontend using quantities to avoid heavy RPC/on-chain math
        const qY = qYes ? Number(formatUnits(qYes as bigint, 18)) : 0;
        const qN = qNo ? Number(formatUnits(qNo as bigint, 18)) : 0;
        const b = bParam ? Number(formatUnits(bParam as bigint, 18)) : 1000;

        let calculatedPriceYes = 0.5;
        if (b > 0) {
            const maxQ = Math.max(qY, qN);
            const expY = Math.exp((qY - maxQ) / b);
            const expN = Math.exp((qN - maxQ) / b);
            calculatedPriceYes = expY / (expY + expN);
        }
        const calculatedPriceNo = 1 - calculatedPriceYes;

        return {
            // Required fields
            id: marketAddress,
            id_numeric: 0,
            name: marketMeta?.name || 'Launchpad Market',
            question: marketMeta?.name || 'Launchpad Market',
            description: `Symbol: ${marketMeta?.symbol || 'N/A'}`,
            contractAddress: marketAddress,
            outcomeTokenAddress: (outcomeTokenAddr as `0x${string}`) || '0x0000000000000000000000000000000000000000',
            chainId, // must match currently selected chain
            mode: 'real' as const,
            adjudicatorKind: 'manual',
            openEnded: true,
            eventId: marketAddress,

            // Status
            status: isSettled ? 'settled' : (isLive === false ? 'cooldown' : 'trading'),

            // Prices
            priceYes: calculatedPriceYes,
            priceNo: calculatedPriceNo,

            // AMM state
            qYes: (qYes as bigint) || 0n,
            qNo: (qNo as bigint) || 0n,
            bParam: (bParam as bigint) || 0n,

            // AMM IS WALLET ONLY (Use Wallet Shares)
            userYesWallet: parseFloat(formatUnits(walletYesShares, 18)),
            userNoWallet: parseFloat(formatUnits(walletNoShares, 18)),

            // OB IS TRADING ACCOUNT ONLY (Use Liquid Vault Shares)
            userYesShares: parseFloat(formatUnits(liquidYes, 18)),
            userNoShares: parseFloat(formatUnits(liquidNo, 18)),

            // Legacy Locked
            userYesLocked: parseFloat(formatUnits(lockYes, 18)),
            userNoLocked: parseFloat(formatUnits(lockNo, 18)),

            userYesOutcomeTokens: parseFloat(formatUnits(walletYesShares, 18)), 
            userNoOutcomeTokens: parseFloat(formatUnits(walletNoShares, 18)),  
            
            // Combined views
            userYesTotal: parseFloat(formatUnits(walletYesShares + liquidYes + lockYes, 18)),
            userNoTotal: parseFloat(formatUnits(walletNoShares + liquidNo + lockNo, 18)),

            unlockTime: 0,
            userAvgEntryYes: null,
            userAvgEntryNo: null,

            // Config
            fee: feeData ? Number(feeData) / 10000 : 0.005,
            adjudicatorId: 'N/A',
            adjudicatorLabel: 'Manual',

            // V5 specific
            isLaunchpad: true,
            isGraduated: marketMeta?.isGraduated || false,
            deadline: marketMeta?.deadline,
        } as Market;
    }, [marketAddress, marketMeta, isSettled, isLive, bParam, qYes, qNo, walletYesShares, walletNoShares, liquidYes, liquidNo, lockYes, lockNo, feeData, outcomeTokenAddr]);

    return {
        market,
        isLoading: isLoading || !onChainData,
        refetch,
    };
}
