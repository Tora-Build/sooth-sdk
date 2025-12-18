import React from 'react';
import { Link } from 'react-router-dom';
import { Coins, ExternalLink, TrendingUp, Percent } from 'lucide-react';
import { Card } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { useLPPositions } from '../../../hooks/useLPPositions';
import { formatCurrency } from '../../../utils/format';

export const LPPositionsCard: React.FC = () => {
    const { positions, totalLPValue, totalLPValueFormatted, isLoading } = useLPPositions();

    const totalValueNum = parseFloat(totalLPValueFormatted);

    if (isLoading) {
        return (
            <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Coins className="w-5 h-5 text-purple-400" />
                    <h3 className="font-bold text-white">LP Positions</h3>
                </div>
                <div className="animate-pulse space-y-3">
                    <div className="h-12 bg-slate-800 rounded-lg" />
                    <div className="h-12 bg-slate-800 rounded-lg" />
                </div>
            </Card>
        );
    }

    if (positions.length === 0) {
        return (
            <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Coins className="w-5 h-5 text-purple-400" />
                    <h3 className="font-bold text-white">LP Positions</h3>
                </div>
                <div className="text-center py-8">
                    <Coins className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400 text-sm">No LP positions yet</p>
                    <p className="text-slate-500 text-xs mt-1">
                        Trade on Launchpad markets to earn LP tokens
                    </p>
                </div>
            </Card>
        );
    }

    return (
        <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Coins className="w-5 h-5 text-purple-400" />
                    <h3 className="font-bold text-white">LP Positions</h3>
                </div>
                <div className="text-right">
                    <div className="text-lg font-bold text-purple-400">
                        {formatCurrency(totalValueNum)}
                    </div>
                    <div className="text-xs text-slate-500">Total LP Value</div>
                </div>
            </div>

            <div className="space-y-3">
                {positions.map((position) => (
                    <Link
                        key={position.marketAddress}
                        to={`/market/${position.marketAddress}`}
                        className="block p-4 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-purple-500/30 transition-all group"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-white group-hover:text-purple-300 transition-colors">
                                    {position.marketName}
                                </span>
                                <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-purple-400 transition-colors" />
                            </div>
                            <div className="flex items-center gap-2">
                                {position.isGraduated ? (
                                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/50 text-xs">
                                        Graduated
                                    </Badge>
                                ) : (
                                    <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/50 text-xs">
                                        Bonding
                                    </Badge>
                                )}
                                {!position.isLive && (
                                    <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/50 text-xs">
                                        Redeemable
                                    </Badge>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                                <div className="text-slate-500 text-xs mb-0.5">LP Tokens</div>
                                <div className="font-mono text-white">
                                    {parseFloat(position.lpBalanceFormatted).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                </div>
                            </div>
                            <div>
                                <div className="text-slate-500 text-xs mb-0.5 flex items-center gap-1">
                                    <TrendingUp className="w-3 h-3" /> Value
                                </div>
                                <div className="font-mono text-purple-400">
                                    {formatCurrency(parseFloat(position.estimatedValueFormatted))}
                                </div>
                            </div>
                            <div>
                                <div className="text-slate-500 text-xs mb-0.5 flex items-center gap-1">
                                    <Percent className="w-3 h-3" /> Share
                                </div>
                                <div className="font-mono text-white">
                                    {position.sharePercent.toFixed(2)}%
                                </div>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </Card>
    );
};
