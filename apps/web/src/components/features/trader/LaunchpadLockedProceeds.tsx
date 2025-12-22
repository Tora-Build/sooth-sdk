import React from 'react';
import { Card } from '../../ui/Card';
import { Clock, TrendingUp } from 'lucide-react';
import { useLockedProceeds } from '../../../hooks/v5/useLockedProceeds';
import { formatUnits } from 'viem';
import { Button } from '../../ui/Button';
import toast from 'react-hot-toast';

/**
 * V6: Component to display and claim locked proceeds for a specific Launchpad market
 * Locked proceeds can be used for reinvestment or claimed after 24h
 */
export const LaunchpadLockedProceeds: React.FC<{
    marketAddress: `0x${string}`;
}> = ({ marketAddress }) => {
    const { userLocked, totalLocked, claimUnlocked, isClaimPending, isClaimConfirmed, refetch } = useLockedProceeds(marketAddress);

    // Don't show if no locked proceeds
    if (!userLocked || userLocked === 0n) {
        return null;
    }

    const lockedAmount = Number(formatUnits(userLocked, 18));

    React.useEffect(() => {
        if (isClaimConfirmed) {
            toast.success('Unlocked proceeds claimed!');
            refetch();
        }
    }, [isClaimConfirmed, refetch]);

    return (
        <Card className="border-amber-500/20 bg-amber-500/5">
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                        <Clock className="text-amber-400" size={16} />
                        <h3 className="text-sm font-medium text-amber-400">Locked Proceeds (V6)</h3>
                    </div>
                    
                    <div className="space-y-1">
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-white">
                                ${lockedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span className="text-xs text-slate-400">USDC</span>
                        </div>
                        
                        <p className="text-xs text-slate-400">
                            Sell proceeds are locked for 24h. You can reinvest them or claim after unlock.
                        </p>
                        {totalLocked && totalLocked > 0n && (
                            <p className="text-xs text-slate-500 mt-1">
                                Total market locked: ${Number(formatUnits(totalLocked, 18)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                        )}
                    </div>
                </div>

                <Button
                    onClick={claimUnlocked}
                    disabled={isClaimPending}
                    className="bg-amber-600 hover:bg-amber-500 text-slate-900"
                >
                    {isClaimPending ? 'Claiming...' : 'Claim Unlocked'}
                </Button>
            </div>
        </Card>
    );
};
