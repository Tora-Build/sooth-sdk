import React, { useState } from 'react';
import { useActivePositions, ActivePosition } from '../../../hooks/useActivePositions';
import { Sparkles, Lock, ArrowRightLeft, ShieldCheck, Trophy, Loader2 } from 'lucide-react';
import { formatCurrency } from '../../../utils/format';
import { useWriteContract, usePublicClient } from 'wagmi';
import { TRADER_VAULT_V4_ABI } from '../../../config/abis';
import { useDeployments } from '../../../hooks/useDeployments';
import toast from 'react-hot-toast';
import { PortfolioCard } from './PortfolioCard';

const PositionItem: React.FC<{ pos: ActivePosition }> = ({ pos }) => {
    const { config } = useDeployments();
    const { writeContractAsync } = useWriteContract();
    const publicClient = usePublicClient();
    const [isRedeeming, setIsRedeeming] = useState(false);
    
    const hasYes = (pos.liquidYes + pos.lockedYes) > 0.001;
    const hasNo = (pos.liquidNo + pos.lockedNo) > 0.001;
    const priceYes = pos.priceYes || 0.5;
    const priceNo = 1 - priceYes;

    const handleRedeem = async () => {
        setIsRedeeming(true);
        try {
            const hash = await writeContractAsync({
                address: config.contracts.SoothTraderVault as `0x${string}`,
                abi: TRADER_VAULT_V4_ABI,
                functionName: 'redeem',
                args: [pos.marketAddress],
            });
            toast.loading('Redeeming shares...', { id: 'redeem' });
            if (publicClient) {
                await publicClient.waitForTransactionReceipt({ hash });
                toast.success('Shares redeemed!', { id: 'redeem' });
            }
        } catch (e: any) {
            toast.error(e.message?.split('\n')[0] || 'Redeem failed', { id: 'redeem' });
        } finally {
            setIsRedeeming(false);
        }
    };

    return (
        <div className="p-3 rounded-lg bg-slate-900/40 border border-slate-800/50 hover:bg-slate-800/40 transition-all group space-y-2 relative overflow-hidden">
            {pos.isSettled && (
                <div className="absolute top-0 right-0 p-1 bg-amber-500/10 border-b border-l border-amber-500/20 rounded-bl-lg">
                    <Trophy size={8} className="text-amber-400" />
                </div>
            )}
            
            <div className="flex justify-between items-start gap-2">
                <h4 className="font-bold text-[11px] text-white leading-tight truncate flex-1 pr-4" title={pos.question}>
                    {pos.question}
                </h4>
            </div>

            <div className="flex flex-col gap-1">
                {hasYes && (
                    <div className="flex items-center justify-between p-1 rounded bg-emerald-500/5 border border-emerald-500/10">
                        <div className="flex items-center gap-1">
                            <span className="text-[8px] font-black px-1 py-0 rounded bg-emerald-500 text-emerald-950">YES</span>
                            <span className="text-[10px] text-white font-mono">{(pos.liquidYes + pos.lockedYes).toFixed(2)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="text-[9px] font-bold text-emerald-400 font-mono">{formatCurrency((pos.liquidYes + pos.lockedYes) * priceYes)}</div>
                            <div className="flex gap-0.5 opacity-40">
                                {pos.lockedYes > 0 && <Lock size={7} className="text-amber-400" />}
                                {pos.liquidYes > 0 && <ArrowRightLeft size={7} className="text-indigo-400" />}
                            </div>
                        </div>
                    </div>
                )}
                {hasNo && (
                    <div className="flex items-center justify-between p-1 rounded bg-rose-500/5 border border-rose-500/10">
                        <div className="flex items-center gap-1">
                            <span className="text-[8px] font-black px-1 py-0 rounded bg-rose-500 text-rose-950">NO</span>
                            <span className="text-[10px] text-white font-mono">{(pos.liquidNo + pos.lockedNo).toFixed(2)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="text-[9px] font-bold text-rose-400 font-mono">{formatCurrency((pos.liquidNo + pos.lockedNo) * priceNo)}</div>
                            <div className="flex gap-0.5 opacity-40">
                                {pos.lockedNo > 0 && <Lock size={7} className="text-amber-400" />}
                                {pos.liquidNo > 0 && <ArrowRightLeft size={7} className="text-indigo-400" />}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {pos.isSettled && (
                <button
                    onClick={handleRedeem}
                    disabled={isRedeeming}
                    className="w-full py-1 rounded bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-[9px] font-bold text-indigo-400 transition-all flex items-center justify-center gap-1.5"
                >
                    {isRedeeming ? <Loader2 size={8} className="animate-spin" /> : <Sparkles size={8} />}
                    REDEEM SETTLED SHARES
                </button>
            )}
        </div>
    );
};

export const VaultPositionsCard: React.FC = () => {
    const { vaultPositions, isLoading } = useActivePositions();

    return (
        <PortfolioCard
            title="Trading Positions"
            icon={<ShieldCheck size={16} className="text-indigo-400" />}
            variant="indigo"
            badge={
                <span className="text-[9px] font-bold text-indigo-400/60 uppercase tracking-widest">
                    {vaultPositions.length} active
                </span>
            }
            itemCount={vaultPositions.length}
            isLoading={isLoading && vaultPositions.length === 0}
            emptyState={
                <div className="py-6 text-center flex flex-col items-center justify-center opacity-40">
                    <Sparkles size={24} className="text-slate-600 mb-1" />
                    <p className="text-[10px] font-mono">// no_vault_positions</p>
                </div>
            }
        >
            {vaultPositions.map(pos => <PositionItem key={pos.id} pos={pos} />)}
        </PortfolioCard>
    );
};
