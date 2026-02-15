import { useAccount, useReadContracts, useChainId } from 'wagmi';
import { formatUnits } from 'viem';
import { MARKET_V4_ABI, LAUNCHPAD_OUTCOME_TOKEN_ABI } from '../config/abis';
import { useMarketStore } from '../store/useMarketStore';
import { useLaunchpadMarkets } from './useLaunchpadMarkets';
import { useMemo } from 'react';
import { getPollingInterval } from '../lib/polling';

export interface ActivePosition {
    id: string;
    question: string;
    marketAddress: `0x${string}`;
    outcomeTokenAddress?: `0x${string}`;
    // Vault portions (Custodial)
    liquidYes: number;
    liquidNo: number;
    lockedYes: number;
    lockedNo: number;

    // Wallet portions (Direct) - AMM IS WALLET ONLY
    walletYes: number;
    walletNo: number;

    unlockTime: number;
    value: number;
    priceYes: number;

    // Settlement info
    isSettled: boolean;
    winningOutcome: number | null;
}

export const useActivePositions = () => {
    const { address } = useAccount();
    const { mode, markets: demoMarkets } = useMarketStore();
    const chainId = useChainId();

    // Get real markets from LaunchpadFactory (on-chain)
    const { markets: launchpadMarkets } = useLaunchpadMarkets();

    // Build market list from LaunchpadFactory (Dynamic)
    const uniqueMarkets = useMemo(() => {
        const list: { address: `0x${string}`, name: string, outcomeToken: `0x${string}` }[] = [];
        const seen = new Set<string>();

        // From LaunchpadFactory (Dynamic)
        if (launchpadMarkets) {
            launchpadMarkets.forEach(m => {
                if (m.address && !seen.has(m.address.toLowerCase())) {
                    seen.add(m.address.toLowerCase());
                    list.push({
                        address: m.address,
                        name: m.name,
                        outcomeToken: m.outcomeToken || '0x0000000000000000000000000000000000000000'
                    });
                }
            });
        }

        return list;
    }, [launchpadMarkets]);

    // Batch Contract Calls (4 calls per market, wallet-only in V12)
    const marketContracts = useMemo(() => {
        if (!address || mode !== 'real') return [];
        return uniqueMarkets.flatMap(m => [
            // 0: Wallet YES (ERC1155)
            {
                address: m.outcomeToken,
                abi: LAUNCHPAD_OUTCOME_TOKEN_ABI,
                functionName: 'balanceOf',
                args: [address, 0n],
                chainId: chainId
            },
            // 1: Wallet NO (ERC1155)
            {
                address: m.outcomeToken,
                abi: LAUNCHPAD_OUTCOME_TOKEN_ABI,
                functionName: 'balanceOf',
                args: [address, 1n],
                chainId: chainId
            },
            // 2: Current Price (YES)
            {
                address: m.address,
                abi: MARKET_V4_ABI,
                functionName: 'price',
                args: [0],
                chainId: chainId
            },
            // 3: isSettled
            {
                address: m.address,
                abi: MARKET_V4_ABI,
                functionName: 'isSettled',
                chainId: chainId
            }
        ]);
    }, [address, uniqueMarkets, chainId, mode]);

    const { data: positionData, refetch, isLoading } = useReadContracts({
        contracts: marketContracts as any,
        query: {
            enabled: mode === 'real' && !!address && uniqueMarkets.length > 0,
            refetchInterval: getPollingInterval(chainId, 'slow'),
            staleTime: 10000
        }
    });

    // Process results into Categories
    return useMemo(() => {
        let vaultPositions: ActivePosition[] = [];
        let vaultValue = 0;

        if (mode === 'demo') {
            Object.entries(demoMarkets).forEach(([, market]) => {
                const yes = market.userYesShares || 0;
                const no = market.userNoShares || 0;
                if (yes > 0 || no > 0) {
                    const val = (yes * (market.priceYes || 0.5)) + (no * (market.priceNo || 0.5));
                    vaultValue += val;
                    vaultPositions.push({
                        id: market.id,
                        question: market.name,
                        marketAddress: market.contractAddress as `0x${string}`,
                        liquidYes: 0,
                        liquidNo: 0,
                        lockedYes: 0,
                        lockedNo: 0,
                        walletYes: yes,
                        walletNo: no,
                        unlockTime: 0,
                        value: val,
                        priceYes: market.priceYes || 0.5,
                        isSettled: false,
                        winningOutcome: null
                    });
                }
            });
        } else if (positionData) {
            uniqueMarkets.forEach((market, idx) => {
                const baseIdx = idx * 4;
                if (baseIdx + 3 >= positionData.length) return;

                const [walletYesRes, walletNoRes, priceRes, settledRes] = [0, 1, 2, 3].map(i => positionData[baseIdx + i]);

                // Parse Price
                let priceYes = 0.5;
                if (priceRes?.result) priceYes = parseFloat(formatUnits(priceRes.result as bigint, 18));
                const priceNo = 1 - priceYes;

                // Vault portions are always zero in V12
                const lockYes = 0;
                const lockNo = 0;
                const liqYes = 0;
                const liqNo = 0;

                // Wallet portions
                let walletYes = 0;
                let walletNo = 0;
                if (walletYesRes?.result) walletYes = parseFloat(formatUnits(walletYesRes.result as bigint, 18));
                if (walletNoRes?.result) walletNo = parseFloat(formatUnits(walletNoRes.result as bigint, 18));

                const isSettled = settledRes?.result as boolean || false;

                const totalYes = liqYes + lockYes + walletYes;
                const totalNo = liqNo + lockNo + walletNo;

                if (totalYes > 0.001 || totalNo > 0.001) {
                    const val = (totalYes * priceYes) + (totalNo * priceNo);
                    vaultValue += val;
                    vaultPositions.push({
                        id: market.address,
                        question: market.name,
                        marketAddress: market.address,
                        outcomeTokenAddress: market.outcomeToken,
                        liquidYes: liqYes,
                        liquidNo: liqNo,
                        lockedYes: lockYes,
                        lockedNo: lockNo,
                        walletYes,
                        walletNo,
                        unlockTime: 0,
                        value: val,
                        priceYes,
                        isSettled,
                        winningOutcome: null
                    });
                }
            });
        }

        return {
            vaultPositions,
            vaultValue,
            totalPositionValue: vaultValue,
            refetch,
            isLoading
        };
    }, [mode, demoMarkets, positionData, uniqueMarkets, refetch, isLoading]);
};
