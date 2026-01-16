// GraduationProgress.tsx - Visual graduation progress indicator for Launchpad markets
// Graduation is based on FEES ACCRUED, not initial liquidity!

import React from 'react';
import { formatUnits } from 'viem';
import { Zap, TrendingUp, Trophy } from 'lucide-react';

interface GraduationProgressProps {
    feesAccrued: bigint;           // WAD (18 decimals) - from getGraduationProgress
    graduationThreshold: bigint;    // WAD (18 decimals) - from getGraduationProgress
    graduationProgress?: number;    // 0-100 percentage (optional, calculated if not provided)
    isGraduated: boolean;
    canGraduate?: boolean;
    onGraduate?: () => void;
    isGraduatePending?: boolean;
}

export const GraduationProgress: React.FC<GraduationProgressProps> = ({
    feesAccrued,
    graduationThreshold,
    graduationProgress,
    isGraduated,
    canGraduate: canGraduateProp,
    onGraduate,
    isGraduatePending
}) => {
    // Values are in WAD (18 decimals) from the contract
    const feesVal = feesAccrued ? parseFloat(formatUnits(feesAccrued, 18)) : 0;
    const thresholdVal = graduationThreshold ? parseFloat(formatUnits(graduationThreshold, 18)) : 10000;

    // Use provided progress or calculate from fees/threshold
    const progressPercent = graduationProgress ?? (thresholdVal > 0 ? Math.min((feesVal / thresholdVal) * 100, 100) : 0);
    const canGraduate = canGraduateProp ?? (progressPercent >= 100 && !isGraduated);

    // Don't render for graduated markets - fee shown in header badge
    if (isGraduated) {
        return null;
    }

    // Full view for bonding markets
    return (
        <div className="rounded-xl bg-slate-900/50 border border-slate-800 p-6 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-500/20 text-blue-400">
                        <Zap size={20} />
                    </div>
                    <div>
                        <div className="font-heading font-semibold text-white">
                            Bonding Curve Progress
                        </div>
                        <div className="text-xs text-slate-500">
                            Liquidity grows with each trade
                        </div>
                    </div>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
                <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Fee Progress</span>
                    <span className="font-mono text-white">
                        {progressPercent.toFixed(1)}%
                    </span>
                </div>

                <div className="relative h-4 bg-slate-800 rounded-full overflow-hidden">
                    {/* Background gradient */}
                    <div
                        className="absolute inset-y-0 left-0 transition-all duration-700 ease-out bg-gradient-to-r from-cyan-600 via-cyan-500 to-emerald-500"
                        style={{ width: `${progressPercent}%` }}
                    />

                    {/* Animated shimmer for bonding */}
                    {progressPercent > 0 && (
                        <div
                            className="absolute inset-y-0 left-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"
                            style={{ width: `${progressPercent}%` }}
                        />
                    )}

                </div>

                <div className="flex justify-between text-xs text-slate-500">
                    <span className="font-mono">${feesVal.toLocaleString(undefined, { maximumFractionDigits: 0 })} earned</span>
                    <span className="font-mono">${thresholdVal.toLocaleString(undefined, { maximumFractionDigits: 0 })} target</span>
                </div>
            </div>

            {/* Graduate Button */}
            {canGraduate && onGraduate && (
                <button
                    onClick={onGraduate}
                    disabled={isGraduatePending}
                    className="w-full py-3 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-white font-bold rounded-lg shadow-lg hover:shadow-yellow-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {isGraduatePending ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Graduating...
                        </>
                    ) : (
                        <>
                            <Trophy size={18} />
                            Graduate Market!
                        </>
                    )}
                </button>
            )}

            {/* Stats Row */}
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-800">
                <div>
                    <div className="text-xs text-slate-500 mb-1">Fees Earned</div>
                    <div className="font-mono text-white">
                        ${feesVal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </div>
                </div>
                <div>
                    <div className="text-xs text-slate-500 mb-1">To Graduation</div>
                    <div className="font-mono text-white flex items-center gap-1">
                        <TrendingUp size={14} className="text-blue-400" />
                        ${Math.max(0, thresholdVal - feesVal).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                </div>
            </div>
        </div>
    );
};
