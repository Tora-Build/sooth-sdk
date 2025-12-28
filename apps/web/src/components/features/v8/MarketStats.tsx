import React, { useMemo } from 'react';
import { Card } from '../../ui/Card';
import { useV8DirectRead, readContractSafe, useLaunchpadMarketDirect } from '../../../hooks/v8';
import { useMarketStatsMath } from '../../../hooks/v8/useMarketStatsMath';
import { useDeployments } from '../../../hooks/useDeployments';
import { ERC20_ABI, V8_ABIS } from '../../../config/abis';
import { formatUnits } from 'viem';
import { useReadContract } from 'wagmi';
import { Info, BarChart3, Scale, PieChart, Package, Anchor, Zap } from 'lucide-react';
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

            <div className="space-y-4">
                {/* 1. Cash Basis */}
                <div className="p-3 rounded-lg border border-slate-800/50 bg-slate-900/40 group hover:border-slate-700/50 transition-colors">
                    <div className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-2 flex items-center justify-between">
                        <span className="flex items-center gap-1">🏦 Cash Basis Formula</span>
                        <span className="text-slate-500 font-mono italic">Seed + Fees + P&L = Gross</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-mono text-[11px]">
                            <span className="text-slate-400" title="Initial Seed">{fmtUsd(stats.seed)}</span>
                            <span className="text-slate-600">+</span>
                            <span className="text-emerald-500/70" title="Trading Fees">{fmtUsd(stats.fees)}</span>
                            <span className="text-slate-600">+</span>
                            <span className={cn("transition-colors", stats.pnl >= 0n ? 'text-emerald-400/80' : 'text-rose-400/80')} title="Swap P&L (LMSR Cost)">
                                {stats.pnl >= 0n ? '+' : '-'}{fmtUsd(stats.pnl < 0n ? -stats.pnl : stats.pnl)}
                            </span>
                            <span className="text-slate-600">=</span>
                        </div>
                        <div className="text-lg font-bold text-white font-mono ml-auto">{fmtUsd(stats.gross)}</div>
                    </div>
                </div>

                {/* 2. Equity Floor */}
                <div className="p-3 rounded-lg border border-cyan-500/20 bg-cyan-500/5 group hover:border-cyan-500/40 transition-colors">
                    <div className="text-[9px] text-cyan-400/70 uppercase font-black tracking-widest mb-2 flex items-center justify-between">
                        <span className="flex items-center gap-1">⚖️ Equity Floor Formula</span>
                        <span className="text-cyan-600/60 font-mono italic">Gross - Liability = Floor</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-mono text-[11px]">
                            <span className="text-slate-400">{fmtUsd(stats.gross)}</span>
                            <span className="text-slate-600">−</span>
                            <span className="text-rose-500/70" title="Max Liability (max(qY, qN))">{fmtUsd(stats.liability)}</span>
                            <span className="text-slate-600">=</span>
                        </div>
                        <div className="text-lg font-bold text-cyan-400 font-mono ml-auto">{fmtUsd(stats.floor)}</div>
                    </div>
                </div>

                {/* 3. Valuation */}
                <div className="p-3 rounded-lg border border-purple-500/20 bg-purple-500/5 group hover:border-purple-500/40 transition-colors">
                    <div className="text-[9px] text-purple-400/70 uppercase font-black tracking-widest mb-2 flex items-center justify-between">
                        <span className="flex items-center gap-1">📈 Valuation (ExRate)</span>
                        <span className="text-purple-600/60 font-mono italic">Equity / Supply = Rate</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-mono text-[11px]">
                            <span className="text-slate-400">{fmtUsd(stats.floor)}</span>
                            <span className="text-slate-600">/</span>
                            <span className="text-slate-400" title="LP Supply">{fmtNum(stats.supply)}</span>
                            <span className="text-slate-600">=</span>
                        </div>
                        <div className="text-lg font-bold text-purple-400 font-mono ml-auto">{stats.floorRate.toFixed(3)}x</div>
                    </div>
                </div>

                {/* 4. TVL */}
                <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 group hover:border-amber-500/40 transition-colors">
                    <div className="text-[9px] text-amber-400/70 uppercase font-black tracking-widest mb-2 flex items-center justify-between">
                        <span className="flex items-center gap-1">📦 TVL Formula</span>
                        <span className="text-amber-600/60 font-mono italic">Cash + Locked = TVL</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-mono text-[11px]">
                            <span className="text-slate-400">{fmtUsd(stats.gross)}</span>
                            <span className="text-slate-600">+</span>
                            <span className="text-amber-500/70" title="Locked Proceeds (24h)">$0.00</span>
                            <span className="text-slate-600">=</span>
                        </div>
                        <div className="text-lg font-bold text-white font-mono ml-auto">{fmtUsd(stats.gross)}</div>
                    </div>
                </div>

                {/* 5. Liquidity Anchor */}
                <div className="p-3 rounded-lg border border-slate-800/50 bg-slate-900/40 group hover:border-slate-700/50 transition-colors">
                    <div className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-2 flex items-center justify-between">
                        <span className="flex items-center gap-1">⚓ Liquidity Anchor Formula</span>
                        <span className="text-slate-500 font-mono italic">b × ln(2) ≈ Supply</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-mono text-[11px]">
                            <span className="text-slate-400" title="Liquidity Depth (b)">{fmtNum(stats.b)}</span>
                            <span className="text-slate-600">×</span>
                            <span className="text-slate-500">0.693</span>
                            <span className="text-slate-600">≈</span>
                        </div>
                        <div className="text-lg font-bold text-slate-300 font-mono ml-auto">{fmtNum(stats.anchorSupply)}</div>
                    </div>
                    <div className="text-[9px] text-slate-600 mt-1 text-right font-mono italic">
                        Real Supply: {fmtNum(stats.supply)}
                    </div>
                </div>

                {/* LP EXRATE RANGE */}
                <div className="pt-4 border-t border-slate-800/50">
                    <div className="flex items-center justify-center gap-4 mb-4">
                        <div className="h-px bg-slate-800 flex-1" />
                        <div className="text-[9px] uppercase font-bold text-purple-400/70 tracking-[0.2em] flex items-center gap-2">
                            <Zap className="w-3 h-3" /> LP EXRATE RANGE <Zap className="w-3 h-3" />
                        </div>
                        <div className="h-px bg-slate-800 flex-1" />
                    </div>

                    <div className="grid grid-cols-2 gap-px bg-slate-800/30 rounded-lg overflow-hidden border border-slate-800/50">
                        <div className="bg-slate-950/40 p-3 text-center">
                            <div className="text-[8px] text-slate-500 uppercase font-black tracking-widest mb-1">Floor</div>
                            <div className="text-xl font-bold text-white tracking-tight">{stats.floorRate.toFixed(3)}x</div>
                        </div>
                        <div className="bg-slate-950/40 p-3 text-center border-l border-slate-800/50">
                            <div className="text-[8px] text-slate-500 uppercase font-black tracking-widest mb-1">Ceiling</div>
                            <div className="text-xl font-bold text-white tracking-tight">{stats.ceilingRate.toFixed(3)}x</div>
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
};
