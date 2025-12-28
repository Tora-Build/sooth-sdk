import React, { useMemo } from 'react';
import { Card } from '../../ui/Card';
import { useV8DirectRead, readContractSafe, useLaunchpadMarketDirect } from '../../../hooks/v8';
import { useMarketStatsMath } from '../../../hooks/v8/useMarketStatsMath';
import { useDeployments } from '../../../hooks/useDeployments';
import { ERC20_ABI, V8_ABIS } from '../../../config/abis';
import { formatUnits } from 'viem';
import { useReadContract } from 'wagmi';
import { Info, BarChart3, Scale, PieChart, Package, Anchor } from 'lucide-react';
import { useChainStore } from '../../../store/useChainStore';
import { cn } from '../../../lib/utils';

interface MarketStatsProps {
    marketAddress: `0x${string}`;
}

export const MarketStats: React.FC<MarketStatsProps> = ({ marketAddress }) => {
    const { selectedChainId } = useChainStore();
    const chainId = typeof selectedChainId === 'number' ? selectedChainId : Number(selectedChainId);
    const deployments = useDeployments();
    const ammEngineAddress = deployments?.contracts?.AMMEngine as `0x${string}`;

    // 1. Get Launchpad Data (Seed, Fees, Floor)
    const { launchpad } = useLaunchpadMarketDirect(marketAddress);

    // 2. USDC Decimals
    const { data: usdcDecimals } = useReadContract({
        address: deployments?.contracts?.MockUSDC as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'decimals',
        query: { enabled: !!deployments?.contracts?.MockUSDC, staleTime: Infinity, refetchInterval: false },
    });
    const decimals = Number(usdcDecimals ?? 18);

    // 3. Get AMM State (qYes, qNo for Liability)
    const { data: ammState } = useV8DirectRead({
        queryKey: ['v8', 'ammState', chainId, ammEngineAddress, marketAddress],
        enabled: !!marketAddress && !!chainId && !!ammEngineAddress,
        chainId,
        read: async (client) => {
            // Need qYes, qNo. Using getMarketState
            const [qYes, qNo, price] = await readContractSafe<readonly [bigint, bigint, bigint]>(client, {
                address: ammEngineAddress!,
                abi: V8_ABIS.AMMEngine,
                functionName: 'getMarketState',
                args: [marketAddress],
            });
            return { qYes, qNo, price };
        },
    });

    // 4. Accounting Math
    const stats = useMarketStatsMath(launchpad as any, ammState, decimals); 

    if (!stats) return null;

    // Formatting helpers
    const fmtUsd = (val: bigint) => {
        const num = Number(formatUnits(val, decimals));
        if (num > 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(2)}B`;
        if (num > 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
        return num.toLocaleString('en-US', { 
            style: 'currency', 
            currency: 'USD',
            maximumFractionDigits: 0
        });
    };
    const fmtNum = (val: bigint | number) => Number(typeof val === 'bigint' ? formatUnits(val, 18) : val).toLocaleString(undefined, { maximumFractionDigits: 0 });
    const fmtVal = (val: bigint) => {
        const num = Math.abs(Number(formatUnits(val, decimals)));
        if (num > 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(2)}B`;
        if (num > 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
        return num.toLocaleString('en-US', { 
            style: 'currency', 
            currency: 'USD',
            maximumFractionDigits: 0
        });
    };

    // P&L Color
    const pnlColor = stats.pnl >= 0n ? 'text-emerald-400' : 'text-rose-400';
    const pnlSign = stats.pnl >= 0n ? '+' : '-';

    // Projection
    const yesWinLpValue = stats.gross - stats.qYes;
    const noWinLpValue = stats.gross - stats.qNo;
    
    // Percent calculation using raw WAD values for precision
    const impliedYes = Number(formatUnits(stats.rawQYes, 18));
    const impliedNo = Number(formatUnits(stats.rawQNo, 18));
    const totalShares = impliedYes + impliedNo;
    const yesPct = totalShares > 0 ? (impliedYes / totalShares) * 100 : 50;

    return (
        <Card className="bg-slate-950/50 border-slate-800 p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-cyan-500" />
                    <h2 className="text-lg font-heading font-bold text-white">Market Stats</h2>
                </div>
                <div className="text-[10px] uppercase font-bold text-cyan-500/50 bg-cyan-950/30 px-2 py-1 rounded">
                    Pure AMM Accounting
                </div>
            </div>

            <div className="space-y-4 font-mono">

                {/* 1. Cash Basis */}
                <div className="bg-slate-900/40 rounded-lg p-4 border border-slate-800/50">
                    <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                            <Package className="w-3 h-3 text-amber-500" />
                            CASH BASIS FORMULA
                        </div>
                        <div className="text-[10px] text-slate-500 italic">SEED + FEES + P&L = GROSS</div>
                    </div>
                    <div className="flex justify-between items-center">
                        <div className="text-sm text-slate-300">
                            {fmtUsd(stats.seed)} + <span className="text-emerald-400">{fmtUsd(stats.fees)}</span> + <span className={pnlColor}>{pnlSign}{fmtVal(stats.pnl)}</span> =
                        </div>
                        <div className="text-xl font-bold text-white tracking-tight">{fmtUsd(stats.gross)}</div>
                    </div>
                </div>

                {/* 2. Equity Floor */}
                <div className="bg-slate-900/40 rounded-lg p-4 border border-slate-800/50">
                    <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                            <Scale className="w-3 h-3 text-cyan-500" />
                            EQUITY FLOOR FORMULA
                        </div>
                        <div className="text-[10px] text-slate-500 italic">GROSS - LIABILITY = FLOOR</div>
                    </div>
                    <div className="flex justify-between items-center">
                        <div className="text-sm text-slate-300">
                            {fmtUsd(stats.gross)} − <span className="text-rose-400">{fmtUsd(stats.liability)}</span> =
                        </div>
                        <div className="text-xl font-bold text-cyan-400 tracking-tight">{fmtUsd(stats.floor)}</div>
                    </div>
                </div>

                {/* 3. Valuation */}
                <div className="bg-slate-900/40 rounded-lg p-4 border border-slate-800/50">
                    <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                            <PieChart className="w-3 h-3 text-purple-500" />
                            VALUATION (EXRATE)
                        </div>
                        <div className="text-[10px] text-slate-500 italic">EQUITY / SUPPLY = RATE</div>
                    </div>
                    <div className="flex justify-between items-center">
                        <div className="text-sm text-slate-300">
                            {fmtUsd(stats.floor)} ÷ {fmtNum(stats.supply)} =
                        </div>
                        <div className="text-xl font-bold text-purple-400 tracking-tight">{stats.floorRate.toFixed(3)}x</div>
                    </div>
                </div>

                {/* 4. Liquidity Anchor */}
                <div className="bg-slate-900/40 rounded-lg p-4 border border-slate-800/50">
                    <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                            <Anchor className="w-3 h-3 text-slate-500" />
                            LIQUIDITY ANCHOR FORMULA
                        </div>
                        <div className="text-[10px] text-slate-500 italic">B * LN(2) ≈ SUPPLY</div>
                    </div>
                    <div className="flex justify-between items-center">
                        <div className="text-sm text-slate-300">
                            {fmtNum(stats.b)} × 0.693 ≈
                        </div>
                        <div className="text-xl font-bold text-white tracking-tight">{fmtNum(stats.anchorSupply)}</div>
                    </div>
                </div>

                {/* 5. LP Payout Sim */}
                <div className="pt-4 border-t border-slate-800">
                    <div className="text-xs font-bold text-slate-400 mb-4 uppercase tracking-wider text-center">LP Payout Simulation</div>

                    <div className="flex justify-between items-end mb-2 px-1">
                        <div className="text-left">
                            <div className="text-[10px] text-emerald-500 font-bold mb-1">IF YES WINS</div>
                            <div className="text-lg font-bold text-white">{fmtUsd(yesWinLpValue)}</div>
                        </div>
                        <div className="text-right">
                            <div className="text-[10px] text-rose-500 font-bold mb-1">IF NO WINS</div>
                            <div className="text-lg font-bold text-white">{fmtUsd(noWinLpValue)}</div>
                        </div>
                    </div>

                    <div className="h-2 rounded-full overflow-hidden bg-slate-800 flex">
                        <div className="bg-emerald-500/50 h-full transition-all duration-500" style={{ width: `${yesPct}%` }} />
                        <div className="bg-rose-500/50 h-full transition-all duration-500" style={{ width: `${100 - yesPct}%` }} />
                    </div>

                    <div className="flex justify-between mt-1 text-[10px] font-mono text-slate-500 px-1">
                        <span>YES Liability: {fmtUsd(stats.qYes)}</span>
                        <span>NO Liability: {fmtUsd(stats.qNo)}</span>
                    </div>
                </div>

            </div>
        </Card>
    );
};
