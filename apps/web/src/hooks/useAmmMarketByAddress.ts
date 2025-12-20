// useAmmMarketByAddress.ts - Hook to fetch market data directly from contract address
// Used for dynamic V5 Launchpad markets that aren't in the static config

import React from 'react';
import { useReadContracts, useAccount } from 'wagmi';
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
    const traderVaultAddress = config?.contracts?.SoothTraderVault as `0x${string}`;

    // Fetch on-chain market data
    const { data: onChainData, refetch, isLoading } = useReadContracts({
        contracts: [
            { address: marketAddress, abi: MARKET_V4_ABI, functionName: 'isLive', chainId: Number(selectedChainId) },
            { address: marketAddress, abi: MARKET_V4_ABI, functionName: 'isSettled', chainId: Number(selectedChainId) },
            { address: marketAddress, abi: MARKET_V4_ABI, functionName: 'price', args: [0], chainId: Number(selectedChainId) },
            { address: marketAddress, abi: MARKET_V4_ABI, functionName: 'b', chainId: Number(selectedChainId) },
            { address: marketAddress, abi: MARKET_V4_ABI, functionName: 'qYes', chainId: Number(selectedChainId) },
            { address: marketAddress, abi: MARKET_V4_ABI, functionName: 'qNo', chainId: Number(selectedChainId) },
            { address: marketAddress, abi: MARKET_V4_ABI, functionName: 'feeLMSR', chainId: Number(selectedChainId) },
            // Get outcome token address for ERC1155 balance check
            { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'outcomeToken', chainId: Number(selectedChainId) },
            // User positions via TraderVault (legacy/OB)
            {
                address: traderVaultAddress,
                abi: TRADER_VAULT_V4_ABI,
                functionName: 'ammPositions',
                args: [userAddress || '0x0000000000000000000000000000000000000000', marketAddress || '0x0000000000000000000000000000000000000000'],
                chainId: Number(selectedChainId)
            }
        ],
        query: {
            enabled: !!marketAddress && !!traderVaultAddress,
            refetchInterval: 15000, // Reduced frequency to 15s to prevent flickering
        }
    });

    const [isLive, isSettled, priceYesWad, bParam, qYes, qNo, feeData, outcomeTokenAddr, ammPosition] = onChainData?.map(r => r.result) || [];

    // Fetch ERC1155 balances (direct swap positions)
    const outcomeTokenAddress = outcomeTokenAddr as `0x${string}` | undefined;
    const { data: erc1155Data } = useReadContracts({
        contracts: outcomeTokenAddress && userAddress ? [
            { address: outcomeTokenAddress, abi: LAUNCHPAD_OUTCOME_TOKEN_ABI, functionName: 'balanceOf', args: [userAddress, 0n], chainId: Number(selectedChainId) }, // YES
            { address: outcomeTokenAddress, abi: LAUNCHPAD_OUTCOME_TOKEN_ABI, functionName: 'balanceOf', args: [userAddress, 1n], chainId: Number(selectedChainId) }, // NO
        ] : [],
        query: {
            enabled: !!outcomeTokenAddress && !!userAddress,
            refetchInterval: 15000,
        }
    });

    // Extract AMM position (TraderVault - legacy)
    const ammPos = ammPosition as [bigint, bigint] | undefined;
    const vaultYesShares = ammPos?.[0] || 0n;
    const vaultNoShares = ammPos?.[1] || 0n;
    
    // Extract ERC1155 balances (direct swap)
    const directYesShares = (erc1155Data?.[0]?.result as bigint) || 0n;
    const directNoShares = (erc1155Data?.[1]?.result as bigint) || 0n;
    
    // Total shares = TraderVault + Direct (ERC1155)
    const ammYesShares = vaultYesShares + directYesShares;
    const ammNoShares = vaultNoShares + directNoShares;

    const market: Market | undefined = React.useMemo(() => {
        if (!marketAddress) return undefined;

        const priceYesRaw = priceYesWad ? BigInt(priceYesWad as bigint) : undefined;
        const calculatedPriceYes = priceYesRaw ? parseFloat(formatUnits(priceYesRaw, 18)) : 0.5;
        const calculatedPriceNo = 1 - calculatedPriceYes;

        return {
            // Required fields
            id: marketAddress,
            id_numeric: 0,
            name: marketMeta?.name || 'Launchpad Market',
            question: marketMeta?.name || 'Launchpad Market',
            description: `Symbol: ${marketMeta?.symbol || 'N/A'}`,
            contractAddress: marketAddress,
            outcomeTokenAddress: '0x0000000000000000000000000000000000000000' as `0x${string}`,
            chainId: 84532, // Base Sepolia - should be dynamic
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

            // User positions
            userYesShares: parseFloat(formatUnits(ammYesShares, 18)),
            userNoShares: parseFloat(formatUnits(ammNoShares, 18)),
            userYesLocked: 0,
            userNoLocked: 0,
            unlockTime: 0,
            userYesOutcomeTokens: 0,
            userNoOutcomeTokens: 0,
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
    }, [marketAddress, marketMeta, isSettled, isLive, priceYesWad, bParam, qYes, qNo, ammYesShares, ammNoShares, feeData]);

    return {
        market,
        isLoading: isLoading || !onChainData,
        refetch,
    };
}
