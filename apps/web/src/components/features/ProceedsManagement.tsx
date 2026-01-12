import React from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
    useAvailableBalance,
    useClaimableAmount,
    useClaimUnlocked,
    useLockQueue
} from '../../hooks';
import { Wallet, Lock, Unlock, Clock, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface ProceedsManagementProps {
    ammEngineAddress: `0x${string}` | undefined;
}

export const ProceedsManagement: React.FC<ProceedsManagementProps> = ({ ammEngineAddress }) => {
    const {
        availableFormatted,
        lockedFormatted,
        withdrawableFormatted,
        isLoading: balancesLoading
    } = useAvailableBalance(ammEngineAddress);

    const {
        claimable,
        claimableFormatted,
        hasClaimable,
        nextUnlockDate,
        isLoading: claimableLoading
    } = useClaimableAmount(ammEngineAddress);

    const { entries, isLoading: queueLoading } = useLockQueue(ammEngineAddress);
    const { claim, isPending, isConfirming, isConfirmed } = useClaimUnlocked(ammEngineAddress);

    const handleClaim = () => {
        if (!hasClaimable) return;
        claim(50);
    };

    const isLoading = balancesLoading || claimableLoading;

    return (
        <div className="space-y-6">
            <Card variant="premium" className="relative overflow-hidden">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                        <Wallet className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white">Spendable Proceeds</h3>
                        <p className="text-sm text-slate-400">V10.8 Modular Liquidity System</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Spendable (Available) */}
                    <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                        <div className="flex items-center gap-2 mb-2 text-emerald-400">
                            <Unlock className="w-4 h-4" />
                            <span className="text-xs font-semibold uppercase tracking-wider">Spendable</span>
                        </div>
                        <div className="text-2xl font-bold text-white">
                            {isLoading ? '...' : `$${availableFormatted}`}
                        </div>
                        <p className="text-[10px] text-emerald-500/60 mt-1">Available for immediate trading</p>
                    </div>

                    {/* Locked */}
                    <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
                        <div className="flex items-center gap-2 mb-2 text-amber-400">
                            <Lock className="w-4 h-4" />
                            <span className="text-xs font-semibold uppercase tracking-wider">Locked</span>
                        </div>
                        <div className="text-2xl font-bold text-white">
                            {isLoading ? '...' : `$${lockedFormatted}`}
                        </div>
                        <p className="text-[10px] text-amber-500/60 mt-1">Under 24h withdrawal lock</p>
                    </div>

                    {/* Withdrawable */}
                    <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
                        <div className="flex items-center gap-2 mb-2 text-slate-400">
                            <Wallet className="w-4 h-4" />
                            <span className="text-xs font-semibold uppercase tracking-wider">Withdrawable</span>
                        </div>
                        <div className="text-2xl font-bold text-slate-300">
                            {isLoading ? '...' : `$${withdrawableFormatted}`}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">Ready to pull to your wallet</p>
                    </div>
                </div>

                {/* Claim Action Area */}
                {hasClaimable ? (
                    <div className="mt-6 p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-emerald-500/20 text-emerald-400">
                                <Unlock className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-white">Proceeds Ready!</p>
                                <p className="text-xs text-slate-400">${claimableFormatted} USDC can be unlocked now</p>
                            </div>
                        </div>
                        <Button
                            onClick={handleClaim}
                            disabled={isPending || isConfirming}
                            className="w-full sm:w-auto min-w-[140px]"
                        >
                            {isPending || isConfirming ? 'Processing...' : 'Claim Now'}
                        </Button>
                    </div>
                ) : nextUnlockDate && (
                    <div className="mt-6 flex items-center gap-2 text-xs text-slate-500 justify-center">
                        <Clock className="w-3 h-3" />
                        <span>Next proceeds unlock: {nextUnlockDate.toLocaleString()}</span>
                    </div>
                )}
            </Card>

            {/* Lock Queue Table */}
            {!queueLoading && entries.length > 0 && (
                <Card className="bg-slate-900/50">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-bold text-white uppercase tracking-widest">Lock History</h4>
                        <Badge variant="outline">{entries.length} Entries</Badge>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="text-slate-500 border-b border-slate-800">
                                <tr>
                                    <th className="pb-3 font-medium">Amount</th>
                                    <th className="pb-3 font-medium text-right">Status</th>
                                    <th className="pb-3 font-medium text-right">Unlock Time</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {entries.map((entry, i) => (
                                    <tr key={i} className="group hover:bg-white/5 transition-colors">
                                        <td className="py-3 font-medium text-white">${entry.amountFormatted}</td>
                                        <td className="py-3 text-right">
                                            {entry.isUnlocked ? (
                                                <Badge variant="success">Ready</Badge>
                                            ) : (
                                                <Badge variant="default">Locked</Badge>
                                            )}
                                        </td>
                                        <td className="py-3 text-right text-slate-400 text-xs">
                                            {entry.isUnlocked ? 'Available' : entry.expiryDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}
        </div>
    );
};
