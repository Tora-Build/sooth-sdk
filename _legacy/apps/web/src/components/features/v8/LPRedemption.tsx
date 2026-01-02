import React, { useState, useMemo } from 'react';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Wallet, Loader2 } from 'lucide-react';
import { formatEther, parseEther } from 'viem';
import toast from 'react-hot-toast';

/**
 * V6: LP Token Redemption Component
 * For settled markets - allows users to redeem LP tokens for USDC
 */
export const LPRedemption: React.FC<{
    marketAddress: `0x${string}`;
    lpBalance?: bigint;
    lpTotalSupply?: bigint;
    totalAssets?: bigint;
    previewRedeemLP: (amount: bigint) => bigint;
    onRedeemLP: (amount: bigint) => void;
    isRedeemPending: boolean;
}> = ({
    lpBalance,
    lpTotalSupply,
    totalAssets,
    previewRedeemLP,
    onRedeemLP,
    isRedeemPending,
}) => {
    const [redeemAmount, setRedeemAmount] = useState('');

    const maxAmount = lpBalance || 0n;
    const maxAmountDisplay = formatEther(maxAmount);

    const redeemAmountBigInt = useMemo(() => {
        if (!redeemAmount) return 0n;
        try {
            const amount = parseFloat(redeemAmount);
            if (isNaN(amount) || amount <= 0) return 0n;
            return parseEther(redeemAmount);
        } catch {
            return 0n;
        }
    }, [redeemAmount]);

    const previewAmount = useMemo(() => {
        if (redeemAmountBigInt === 0n || redeemAmountBigInt > maxAmount) return 0n;
        return previewRedeemLP(redeemAmountBigInt);
    }, [redeemAmountBigInt, maxAmount, previewRedeemLP]);

    const handleMax = () => {
        setRedeemAmount(maxAmountDisplay);
    };

    const handleRedeem = () => {
        if (redeemAmountBigInt === 0n || redeemAmountBigInt > maxAmount) {
            toast.error('Invalid redemption amount');
            return;
        }
        onRedeemLP(redeemAmountBigInt);
        setRedeemAmount('');
    };

    if (!lpBalance || lpBalance === 0n) return null;

    return (
        <Card className="border-blue-500/30 bg-blue-500/5">
            <div className="p-6 space-y-4">
                <div className="flex items-center gap-2">
                    <Wallet className="text-blue-400" size={20} />
                    <h3 className="font-heading font-semibold text-blue-400">LP Token Redemption</h3>
                </div>

                {/* Info */}
                <div className="text-sm text-slate-400 space-y-1">
                    <div className="flex justify-between">
                        <span>Your LP Balance:</span>
                        <span className="font-mono text-white">{maxAmountDisplay} LP</span>
                    </div>
                    {totalAssets && lpTotalSupply && (
                        <>
                            <div className="flex justify-between">
                                <span>Total Market Assets:</span>
                                <span className="font-mono text-white">{formatEther(totalAssets)} USDC</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Total LP Supply:</span>
                                <span className="font-mono text-white">{formatEther(lpTotalSupply)} LP</span>
                            </div>
                        </>
                    )}
                </div>

                {/* Redemption Input */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-sm text-slate-400">Redeem Amount (LP)</label>
                        <button
                            onClick={handleMax}
                            className="text-xs text-blue-400 hover:text-blue-300 underline"
                        >
                            Max
                        </button>
                    </div>
                    <input
                        type="number"
                        value={redeemAmount}
                        onChange={(e) => setRedeemAmount(e.target.value)}
                        placeholder="0.0"
                        min="0"
                        step="0.01"
                        max={maxAmountDisplay}
                        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-blue-500"
                    />
                </div>

                {/* Preview */}
                {redeemAmountBigInt > 0n && redeemAmountBigInt <= maxAmount && (
                    <div className="p-3 bg-slate-800/50 rounded-lg">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-400">You will receive:</span>
                            <span className="font-mono font-bold text-white">
                                {formatEther(previewAmount)} USDC
                            </span>
                        </div>
                    </div>
                )}

                {/* Redeem Button */}
                <Button
                    onClick={handleRedeem}
                    disabled={isRedeemPending || redeemAmountBigInt === 0n || redeemAmountBigInt > maxAmount}
                    className="w-full bg-blue-600 hover:bg-blue-500"
                >
                    {isRedeemPending ? (
                        <span className="flex items-center justify-center gap-2">
                            <Loader2 size={18} className="animate-spin" />
                            Processing...
                        </span>
                    ) : (
                        'Redeem LP Tokens'
                    )}
                </Button>
            </div>
        </Card>
    );
};
