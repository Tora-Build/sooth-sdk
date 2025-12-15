// GraduationProgress.tsx - Visual graduation progress indicator for Launchpad markets

import React from 'react';
import { formatEther } from 'viem';
import { Zap, TrendingUp, Trophy } from 'lucide-react';

interface GraduationProgressProps {
    bBase: bigint;
    graduationThreshold: bigint;
    isGraduated: boolean;
    feesAccrued?: bigint;
    onGraduate?: () => void;
    isGraduatePending?: boolean;
}

export const GraduationProgress: React.FC<GraduationProgressProps> = ({
    bBase,
    graduationThreshold,
    isGraduated,
    feesAccrued,
    onGraduate,
    isGraduatePending
}) => {
    const currentLiq = bBase ? parseFloat(formatEther(bBase)) : 0;
    const thresholdVal = graduationThreshold ? parseFloat(formatEther(graduationThreshold)) : 10000;
    const progressPercent = Math.min((currentLiq / thresholdVal) * 100, 100);
    const canGraduate = progressPercent >= 100 && !isGraduated;

    // Fee rate based on graduation
    const feeRate = isGraduated ? '1%' : '5%';
    const feeLabel = isGraduated ? 'Graduated Fee' : 'Bonding Fee';

    return (
        <div className="rounded-xl bg-slate-900/50 border border-slate-800 p-6 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isGraduated
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-blue-500/20 text-blue-400'
                        }`}>
                        {isGraduated ? <Trophy size={20} /> : <Zap size={20} />}
                    </div>
                    <div>
                        <div className="font-heading font-semibold text-white">
                            {isGraduated ? 'Graduated' : 'Bonding Curve Progress'}
                        </div>
                        <div className="text-xs text-slate-500">
                            {isGraduated ? 'Market is now fully liquid' : 'Liquidity grows with each trade'}
                        </div>
                    </div>
                </div>

                {/* Fee Badge */}
                <div className={`px-3 py-1 rounded-full text-xs font-bold ${isGraduated
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                    }`}>
                    {feeLabel}: {feeRate}
                </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
                <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Liquidity</span>
                    <span className="font-mono text-white">
                        {progressPercent.toFixed(1)}%
                    </span>
                </div>

                <div className="relative h-4 bg-slate-800 rounded-full overflow-hidden">
                    {/* Background gradient */}
                    <div
                        className={`absolute inset-y-0 left-0 transition-all duration-700 ease-out ${isGraduated
                                ? 'bg-gradient-to-r from-emerald-600 to-emerald-400'
                                : 'bg-gradient-to-r from-blue-600 via-purple-600 to-pink-500'
                            }`}
                        style={{ width: `${progressPercent}%` }}
                    />

                    {/* Animated shimmer for bonding */}
                    {!isGraduated && progressPercent > 0 && (
                        <div
                            className="absolute inset-y-0 left-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"
                            style={{ width: `${progressPercent}%` }}
                        />
                    )}

                    {/* Threshold marker */}
                    <div className="absolute inset-y-0 right-0 w-1 bg-white/30" />
                </div>

                <div className="flex justify-between text-xs text-slate-500">
                    <span className="font-mono">${currentLiq.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
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
                    <div className="text-xs text-slate-500 mb-1">Total Fees Earned</div>
                    <div className="font-mono text-white">
                        ${feesAccrued ? parseFloat(formatEther(feesAccrued)).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0.00'}
                    </div>
                </div>
                <div>
                    <div className="text-xs text-slate-500 mb-1">To Graduation</div>
                    <div className="font-mono text-white flex items-center gap-1">
                        {isGraduated ? (
                            <span className="text-emerald-400">✓ Complete</span>
                        ) : (
                            <>
                                <TrendingUp size={14} className="text-blue-400" />
                                ${Math.max(0, thresholdVal - currentLiq).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
