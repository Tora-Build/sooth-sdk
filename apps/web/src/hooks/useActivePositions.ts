import { useAccount, useReadContracts } from 'wagmi';
import { formatUnits } from 'viem';
import { TRADER_VAULT_V4_ABI, MARKET_V4_ABI } from '../config/abis';
import { useDeployments } from './useDeployments';
import { useMarketStore } from '../store/useMarketStore';
import { useChainStore } from '../store/useChainStore';
import marketsConfig from '../config/markets.json';

export interface ActivePosition {
    id: string;
    question: string;
    liquidYes: number;
    liquidNo: number;
    lockedYes: number;
    lockedNo: number;
    unlockTime: number;
    value: number;
    priceYes: number;
}

export const useActivePositions = () => {
    const { address } = useAccount();
    const { mode, markets: demoMarkets } = useMarketStore();
    const { config } = useDeployments();
    const deployments = config.contracts;
    const { selectedChainId } = useChainStore();

    const traderVaultAddress = deployments.SoothTraderVault as `0x${string}`;

    // Chain Filter (Real Mode only)
    const realMarkets = marketsConfig.markets.filter(m => m.mode === 'real' && m.chainId === selectedChainId);

    // Batch Contract Calls
    const marketContracts = realMarkets.flatMap(m => [
        // 0: AMM Positions (Locked) -> returns (yesShares, noShares, unlockTime)
        {
            address: traderVaultAddress,
            abi: TRADER_VAULT_V4_ABI,
            functionName: 'ammPositions',
            args: [address || '0x0000000000000000000000000000000000000000', m.contractAddress as `0x${string}`]
        },
        // 1: Orderbook YES (Liquid)
        {
            address: traderVaultAddress,
            abi: TRADER_VAULT_V4_ABI,
            functionName: 'shareBalances',
            args: [address || '0x0000000000000000000000000000000000000000', m.contractAddress as `0x${string}`, 0]
        },
        // 2: Orderbook NO (Liquid)
        {
            address: traderVaultAddress,
            abi: TRADER_VAULT_V4_ABI,
            functionName: 'shareBalances',
            args: [address || '0x0000000000000000000000000000000000000000', m.contractAddress as `0x${string}`, 1]
        },
        // 3: Current Price (YES)
        { address: m.contractAddress as `0x${string}`, abi: MARKET_V4_ABI, functionName: 'price', args: [0] },
    ]);

    const { data: positionData, refetch, isLoading } = useReadContracts({
        contracts: marketContracts as any,
        query: { enabled: mode === 'real' && !!address && realMarkets.length > 0, refetchInterval: 10000 }
    });

    // Calculate position values
    let activePositions: ActivePosition[] = [];
    let totalPositionValue = 0;

    if (mode === 'demo') {
        Object.entries(demoMarkets).forEach(([, market]) => {
            const yes = market.userYesShares || 0;
            const no = market.userNoShares || 0;
            if (yes > 0 || no > 0) {
                const val = (yes * (market.priceYes || 0.5)) + (no * (market.priceNo || 0.5));
                totalPositionValue += val;
                activePositions.push({
                    id: market.id,
                    question: market.question,
                    liquidYes: yes,
                    liquidNo: no,
                    lockedYes: 0,
                    lockedNo: 0,
                    unlockTime: 0,
                    value: val,
                    priceYes: market.priceYes || 0.5
                });
            }
        });
    } else if (positionData) {
        realMarkets.forEach((market, idx) => {
            const baseIdx = idx * 4;
            const [ammPosRes, obYesRes, obNoRes, priceRes] = [0, 1, 2, 3].map(i => positionData[baseIdx + i]);

            // Parse Price
            let priceYes = 0.5;
            if (priceRes?.result) priceYes = parseFloat(formatUnits(priceRes.result as bigint, 18));
            const priceNo = 1 - priceYes;

            // Parse AMM Locked (WAD - 18 decimals) - V4.6: only 2 fields, no unlockTime
            let lockYes = 0, lockNo = 0, unlockTime = 0;
            if (ammPosRes?.result) {
                const pos = ammPosRes.result as [bigint, bigint];
                lockYes = parseFloat(formatUnits(pos[0], 18));
                lockNo = parseFloat(formatUnits(pos[1], 18));
                // V4.6 Lock-on-Sell: unlockTime always 0 (shares never locked)
            }

            // Parse Orderbook Liquid (WAD - 18 decimals, same as AMM)
            let liqYes = 0, liqNo = 0;
            if (obYesRes?.result) liqYes = parseFloat(formatUnits(obYesRes.result as bigint, 18));
            if (obNoRes?.result) liqNo = parseFloat(formatUnits(obNoRes.result as bigint, 18));

            const totalYes = liqYes + lockYes;
            const totalNo = liqNo + lockNo;

            if (totalYes > 0.001 || totalNo > 0.001) {
                const val = (totalYes * priceYes) + (totalNo * priceNo);
                totalPositionValue += val;
                activePositions.push({
                    id: market.id,
                    question: market.question,
                    liquidYes: liqYes,
                    liquidNo: liqNo,
                    lockedYes: lockYes,
                    lockedNo: lockNo,
                    unlockTime,
                    value: val,
                    priceYes
                });
            }
        });
    }

    return { activePositions, totalPositionValue, refetch, isLoading };
};
