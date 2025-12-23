import React from 'react';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Skull, Loader2 } from 'lucide-react';
import { formatEther } from 'viem';
import toast from 'react-hot-toast';

/**
 * V6: Liquidation Refund Component
 * For liquidated markets - allows users to claim refunds proportional to LP tokens
 */
export const LiquidationRefund: React.FC<{
    marketAddress: `0x${string}`;
    isLiquidated: boolean;
    lpBalance?: bigint;
    liquidationRefundAmount?: bigint;
    liquidationFeeBps?: bigint;
    onClaimLiquidationRefund: () => void;
    isClaimPending: boolean;
}> = ({
    isLiquidated,
    lpBalance,
    liquidationRefundAmount,
    liquidationFeeBps,
    onClaimLiquidationRefund,
    isClaimPending,
}) => {
    if (!isLiquidated || !lpBalance || lpBalance === 0n) return null;

    const refundAmount = liquidationRefundAmount || 0n;
    const feePercent = liquidationFeeBps ? Number(liquidationFeeBps) / 100 : 0;

    return (
        <Card className="border-red-500/30 bg-red-500/5">
            <div className="p-6 space-y-4">
                <div className="flex items-center gap-2">
                    <Skull className="text-red-400" size={20} />
                    <h3 className="font-heading font-semibold text-red-400">Liquidation Refund</h3>
                </div>

                <div className="text-sm text-slate-400 space-y-2">
                    <p>
                        This market has been liquidated. You can claim your refund proportional to your LP token balance.
                    </p>
                    {feePercent > 0 && (
                        <p className="text-xs text-slate-500">
                            Note: A {feePercent}% protocol fee was taken during liquidation.
                        </p>
                    )}
                </div>

                {/* Stats */}
                <div className="space-y-2 p-3 bg-slate-800/50 rounded-lg">
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Your LP Balance:</span>
                        <span className="font-mono text-white">{formatEther(lpBalance)} LP</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Refund Amount:</span>
                        <span className="font-mono font-bold text-white">
                            {formatEther(refundAmount)} USDC
                        </span>
                    </div>
                </div>

                {/* Claim Button */}
                <Button
                    onClick={onClaimLiquidationRefund}
                    disabled={isClaimPending || refundAmount === 0n}
                    className="w-full bg-red-600 hover:bg-red-500"
                >
                    {isClaimPending ? (
                        <span className="flex items-center justify-center gap-2">
                            <Loader2 size={18} className="animate-spin" />
                            Processing...
                        </span>
                    ) : (
                        'Claim Liquidation Refund'
                    )}
                </Button>

                <p className="text-xs text-slate-500 text-center">
                    LP tokens will be burned when you claim your refund.
                </p>
            </div>
        </Card>
    );
};
