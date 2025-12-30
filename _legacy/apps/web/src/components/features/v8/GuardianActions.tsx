import React from 'react';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { AlertTriangle, GraduationCap, Skull } from 'lucide-react';
import { formatEther, formatUnits } from 'viem';
import toast from 'react-hot-toast';

/**
 * V6: Guardian Actions Panel
 * Only visible to Guardian users
 * Allows force graduation and liquidation of markets
 */
export const GuardianActions: React.FC<{
    marketAddress: `0x${string}`;
    isGuardian: boolean;
    isGraduated: boolean;
    isLive: boolean;
    isExpired: boolean;
    isLiquidated: boolean;
    bBase?: bigint;
    graduationThreshold?: bigint;
    liquidationFeeBps?: bigint;
    totalAssets?: bigint;
    onForceGraduate: () => void;
    onLiquidate: () => void;
    isForceGraduatePending: boolean;
    isLiquidatePending: boolean;
}> = ({
    isGuardian,
    isGraduated,
    isLive,
    isExpired,
    isLiquidated,
    bBase,
    graduationThreshold,
    liquidationFeeBps,
    totalAssets,
    onForceGraduate,
    onLiquidate,
    isForceGraduatePending,
    isLiquidatePending,
}) => {
    if (!isGuardian) return null;

    const canForceGraduate = !isGraduated;
    const canLiquidate = isExpired && !isLiquidated && !isLive;

    const liquidationFee = totalAssets && liquidationFeeBps
        ? (totalAssets * liquidationFeeBps) / 10000n
        : 0n;

    const handleForceGraduate = () => {
        if (!confirm('Are you sure you want to force graduate this market? This will bypass the graduation threshold check.')) {
            return;
        }
        onForceGraduate();
    };

    const handleLiquidate = () => {
        const feePercent = liquidationFeeBps ? Number(liquidationFeeBps) / 100 : 0;
        if (!confirm(`Are you sure you want to liquidate this market? This will take a ${feePercent}% protocol fee and allow users to claim refunds.`)) {
            return;
        }
        onLiquidate();
    };

    if (!canForceGraduate && !canLiquidate) return null;

    return (
        <Card className="border-amber-500/30 bg-amber-500/5">
            <div className="p-6 space-y-4">
                <div className="flex items-center gap-2">
                    <AlertTriangle className="text-amber-400" size={20} />
                    <h3 className="font-heading font-semibold text-amber-400">Guardian Actions</h3>
                </div>

                {/* Force Graduate */}
                {canForceGraduate && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <GraduationCap className="text-amber-400" size={16} />
                                    <span className="font-medium text-white">Force Graduate</span>
                                </div>
                                <p className="text-sm text-slate-400">
                                    Force market to graduate without meeting threshold. Use only if market is stuck.
                                </p>
                                {bBase && graduationThreshold && (
                                    <p className="text-xs text-slate-500 mt-1">
                                        Current: {formatEther(bBase)} / Threshold: {formatEther(graduationThreshold)}
                                    </p>
                                )}
                            </div>
                            <Button
                                onClick={handleForceGraduate}
                                disabled={isForceGraduatePending}
                                className="bg-amber-600 hover:bg-amber-500"
                            >
                                {isForceGraduatePending ? 'Processing...' : 'Force Graduate'}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Liquidate */}
                {canLiquidate && (
                    <div className="space-y-3 pt-3 border-t border-amber-500/20">
                        <div className="flex items-center justify-between">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <Skull className="text-red-400" size={16} />
                                    <span className="font-medium text-white">Liquidate Market</span>
                                </div>
                                <p className="text-sm text-slate-400">
                                    Liquidate expired market. Protocol fee will be taken and users can claim refunds.
                                </p>
                                {liquidationFeeBps && (
                                    <p className="text-xs text-slate-500 mt-1">
                                        Protocol fee: {Number(liquidationFeeBps) / 100}%
                                        {totalAssets && liquidationFee > 0n && (
                                            <span className="ml-1">
                                                ({formatEther(liquidationFee)} USDC)
                                            </span>
                                        )}
                                    </p>
                                )}
                            </div>
                            <Button
                                onClick={handleLiquidate}
                                disabled={isLiquidatePending}
                                className="bg-red-600 hover:bg-red-500"
                            >
                                {isLiquidatePending ? 'Processing...' : 'Liquidate'}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </Card>
    );
};
