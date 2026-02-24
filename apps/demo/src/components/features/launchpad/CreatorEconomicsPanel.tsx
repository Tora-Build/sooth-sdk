import { useState, useMemo } from 'react';
import { Coins, TrendingUp, Target, Sparkles, ArrowRight, Award } from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
    calculateCreatorPnL,
    formatCurrency,
    LN2
} from '../../../lib/pnl-calculators';

interface CreatorEconomicsPanelProps {
    deposit: number;
}

export const CreatorEconomicsPanel = ({ deposit }: CreatorEconomicsPanelProps) => {
    const [volume, setVolume] = useState(100000);

    const liquidityTier = Math.round(deposit / LN2);
    
    const result = useMemo(() => 
        calculateCreatorPnL(liquidityTier, volume, 0.5),
        [liquidityTier, volume]
    );

    const progressPercent = Math.min(100, (result.preGradFees / result.graduationThreshold) * 100);

    return (
        <div className="space-y-6">
            <div className="p-5 rounded-2xl bg-gradient-to-br from-cyan-500/10 via-cyan-500/5 to-cyan-500/10 border border-cyan-500/20">
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-cyan-500/30 shrink-0">
                        <Coins className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h3 className="font-black text-white text-lg">Creator Economics</h3>
                        <p className="text-sm text-white/60 mt-1">
                            Earn <span className="text-emerald-400 font-bold">5% fees</span> on all trading volume. 
                            Your deposit seeds the orderbook.
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                        <Coins className="w-4 h-4 text-cyan-400" />
                    </div>
                        <span className="text-xs text-white/50 uppercase font-bold">Your Deposit</span>
                    </div>
                    <p className="text-2xl font-mono font-black text-white">
                        ${deposit.toLocaleString()}
                    </p>
                    <p className="text-xs text-white/40 mt-1">
                        b × ln(2) formula
                    </p>
                </div>

                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                            <Award className="w-4 h-4 text-emerald-400" />
                        </div>
                        <span className="text-xs text-white/50 uppercase font-bold">LP Tokens</span>
                    </div>
                    <p className="text-2xl font-mono font-black text-emerald-400">
                        {deposit.toLocaleString()}
                    </p>
                    <p className="text-xs text-white/40 mt-1">
                        1:1 with deposit
                    </p>
                </div>
            </div>

            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <span className="text-sm text-white/60 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        Projected Trading Volume
                    </span>
                    <span className="text-sm font-mono font-bold text-white">
                        ${(volume / 1000).toFixed(0)}k
                    </span>
                </div>
                <input
                    type="range"
                    min="1000"
                    max="500000"
                    step="1000"
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
                <div className="flex justify-between text-xs text-white/30 font-mono">
                    <span>$1k</span>
                    <span>$500k</span>
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-white/60 flex items-center gap-2">
                        <Target className="w-4 h-4" />
                        Graduation Progress
                    </span>
                    <span className={cn(
                        "font-bold",
                        result.isGraduated ? "text-emerald-400" : "text-white/70"
                    )}>
                        {result.isGraduated ? "Graduated!" : `${progressPercent.toFixed(0)}%`}
                    </span>
                </div>
                <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                    <div
                        className={cn(
                            "h-full rounded-full transition-all duration-500",
                            result.isGraduated
                                ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                                : "bg-gradient-to-r from-cyan-500 to-cyan-600"
                        )}
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
                <div className="flex justify-between text-xs text-white/40">
                    <span>{formatCurrency(result.preGradFees)} fees</span>
                    <span>{formatCurrency(result.graduationThreshold)} threshold</span>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                    <p className="text-xs text-white/40 uppercase font-bold">Break-Even</p>
                    <p className="text-lg font-mono font-bold text-white mt-1">
                        {formatCurrency(result.breakEvenVolume)}
                    </p>
                    <p className="text-xs text-white/30">volume</p>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                    <p className="text-xs text-white/40 uppercase font-bold">Total Fees</p>
                    <p className="text-lg font-mono font-bold text-emerald-400 mt-1">
                        {formatCurrency(result.totalFees)}
                    </p>
                    <p className="text-xs text-white/30">earned</p>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                    <p className="text-xs text-white/40 uppercase font-bold">Est. ROI</p>
                    <p className={cn(
                        "text-lg font-mono font-bold mt-1",
                        result.roi >= 0 ? "text-emerald-400" : "text-red-400"
                    )}>
                        {result.roi >= 0 ? '+' : ''}{result.roi}%
                    </p>
                    <p className="text-xs text-white/30">return</p>
                </div>
            </div>

            {result.isGraduated && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
                    <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-4 h-4 text-emerald-400" />
                        <span className="font-bold text-white text-sm">Post-Graduation Fee Split</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                        <div className="flex-1 p-2 rounded-lg bg-cyan-500/20 text-center">
                            <p className="text-cyan-300 font-bold">50%</p>
                            <p className="text-xs text-white/50">bBase</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-white/30 shrink-0" />
                        <div className="flex-1 p-2 rounded-lg bg-emerald-500/20 text-center">
                            <p className="text-emerald-300 font-bold">30%</p>
                            <p className="text-xs text-white/50">LP Yield</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-white/30 shrink-0" />
                        <div className="flex-1 p-2 rounded-lg bg-blue-500/20 text-center">
                            <p className="text-blue-300 font-bold">20%</p>
                            <p className="text-xs text-white/50">Protocol</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
