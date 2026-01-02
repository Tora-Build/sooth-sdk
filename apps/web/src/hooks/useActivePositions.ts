import { useAccount, useReadContracts, useChainId } from 'wagmi';
import { formatUnits } from 'viem';
import { TRADER_VAULT_V4_ABI, MARKET_V4_ABI, LAUNCHPAD_OUTCOME_TOKEN_ABI } from '../config/abis';
import { useDeployments } from './useDeployments';
import { useMarketStore } from '../store/useMarketStore';
import { useLaunchpadMarkets } from './useLaunchpadMarkets';
import { useMemo } from 'react';

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
    const { config } = useDeployments();
    const deployments = config.contracts;
    const chainId = useChainId();

    const traderVaultAddress = deployments.SoothTraderVault as `0x${string}`;

    // Get real markets from LaunchpadFactory (on-chain)
    const { markets: launchpadMarkets } = useLaunchpadMarkets();
    
    // Build unique market list from both factory and static config
    const uniqueMarkets = useMemo(() => {
        const list: { address: `0x${string}`, name: string, outcomeToken: `0x${string}` }[] = [];
        const seen = new Set<string>();

        // From deployments.json (Static)
        if (config.marketInfo) {
            Object.values(config.marketInfo).forEach((m: any) => {
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
    }, [config.marketInfo, launchpadMarkets]);

    // Batch Contract Calls
    const marketContracts = useMemo(() => {
        if (!address || mode !== 'real') return [];
        return uniqueMarkets.flatMap(m => [
            // 0: AMM Positions (Locked in Vault)
            {
                address: traderVaultAddress,
                abi: TRADER_VAULT_V4_ABI,
                functionName: 'ammPositions',
                args: [address, m.address],
                chainId: chainId
            },
            // 1: Orderbook YES (Liquid in Vault)
            {
                address: traderVaultAddress,
                abi: TRADER_VAULT_V4_ABI,
                functionName: 'shareBalances',
                args: [address, m.address, 0],
                chainId: chainId
            },
            // 2: Orderbook NO (Liquid in Vault)
            {
                address: traderVaultAddress,
                abi: TRADER_VAULT_V4_ABI,
                functionName: 'shareBalances',
                args: [address, m.address, 1],
                chainId: chainId
            },
            // 3: Wallet YES (ERC1155) - AMM IS WALLET ONLY
            {
                address: m.outcomeToken,
                abi: LAUNCHPAD_OUTCOME_TOKEN_ABI,
                functionName: 'balanceOf',
                args: [address, 0n],
                chainId: chainId
            },
            // 4: Wallet NO (ERC1155) - AMM IS WALLET ONLY
            {
                address: m.outcomeToken,
                abi: LAUNCHPAD_OUTCOME_TOKEN_ABI,
                functionName: 'balanceOf',
                args: [address, 1n],
                chainId: chainId
            },
            // 5: Current Price (YES)
            { 
                address: m.address, 
                abi: MARKET_V4_ABI, 
                functionName: 'price', 
                args: [0],
                chainId: chainId
            },
            // 6: isSettled
            {
                address: m.address,
                abi: MARKET_V4_ABI,
                functionName: 'isSettled',
                chainId: chainId
            }
        ]);
    }, [address, uniqueMarkets, traderVaultAddress, chainId, mode]);

    const { data: positionData, refetch, isLoading } = useReadContracts({
        contracts: marketContracts as any,
        query: { 
            enabled: mode === 'real' && !!address && uniqueMarkets.length > 0, 
            refetchInterval: 30000, staleTime: 10000 
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
                        liquidYes: yes,
                        liquidNo: no,
                        lockedYes: 0,
                        lockedNo: 0,
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
                const baseIdx = idx * 7; // Updated to 7 calls per market
                if (baseIdx + 6 >= positionData.length) return;

                const [ammPosRes, obYesRes, obNoRes, walletYesRes, walletNoRes, priceRes, settledRes] = [0, 1, 2, 3, 4, 5, 6].map(i => positionData[baseIdx + i]);

                // Parse Price
                let priceYes = 0.5;
                if (priceRes?.result) priceYes = parseFloat(formatUnits(priceRes.result as bigint, 18));
                const priceNo = 1 - priceYes;

                // Vault portions
                let lockYes = 0, lockNo = 0;
                if (ammPosRes?.result) {
                    const pos = ammPosRes.result as [bigint, bigint];
                    lockYes = parseFloat(formatUnits(pos[0], 18));
                    lockNo = parseFloat(formatUnits(pos[1], 18));
                }
                let liqYes = 0, liqNo = 0;
                if (obYesRes?.result) liqYes = parseFloat(formatUnits(obYesRes.result as bigint, 18));
                if (obNoRes?.result) liqNo = parseFloat(formatUnits(obNoRes.result as bigint, 18));

                // Wallet portions - AMM IS WALLET ONLY
                let walletYes = 0, walletNo = 0;
                if (walletYesRes?.result) walletYes = parseFloat(formatUnits(walletYesRes.result as bigint, 18));
                if (walletNoRes?.result) walletNo = parseFloat(formatUnits(walletNoRes.result as bigint, 18));

                const isSettled = settledRes?.result as boolean || false;

                const totalYes = liqYes + lockYes + walletYes;
                const totalNo = liqNo + lockNo + walletNo;

                // Add to Global Positions
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
                        walletYes: walletYes,
                        walletNo: walletNo,
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
    }, [mode, demoMarkets, positionData, uniqueMarkets]);
};
