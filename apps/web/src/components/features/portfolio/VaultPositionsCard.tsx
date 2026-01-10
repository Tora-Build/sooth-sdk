import React, { useState } from 'react';
import { useActivePositions, ActivePosition } from '../../../hooks/useActivePositions';
import { Sparkles, Lock, ArrowRightLeft, ShieldCheck, Trophy, Loader2, ArrowUpRight, ArrowDownLeft, GitMerge, Scissors, Wallet } from 'lucide-react';
import { formatCurrency } from '../../../utils/format';
import { useWriteContract, usePublicClient } from 'wagmi';
import { TRADER_VAULT_V4_ABI } from '../../../config/abis';
import { useDeployments } from '../../../hooks/useDeployments';
import toast from 'react-hot-toast';
import { PortfolioCard } from './PortfolioCard';
import { PositionActionsModal } from './PositionActionsModal';
import { Button } from '../../ui/Button';

const PositionItem: React.FC<{ pos: ActivePosition; refetch: () => void }> = ({ pos, refetch }) => {
    const { config } = useDeployments();
    const { writeContractAsync } = useWriteContract();
    const publicClient = usePublicClient();
    const [isRedeeming, setIsRedeeming] = useState(false);
    const [modalMode, setModalMode] = useState<'merge' | 'split' | null>(null);
    const traderVaultAddress = config?.contracts?.SoothTraderVault as `0x${string}` | undefined;
    
    const hasYes = (pos.liquidYes + pos.lockedYes + pos.walletYes) > 0.001;
    const hasNo = (pos.liquidNo + pos.lockedNo + pos.walletNo) > 0.001;
    const priceYes = pos.priceYes || 0.5;
    const priceNo = 1 - priceYes;

    const handleRedeem = async () => {
        setIsRedeeming(true);
        try {
            if (!traderVaultAddress) {
                toast.error('Missing TraderVault deployment for this chain');
                return;
            }
            const hash = await writeContractAsync({
                address: traderVaultAddress,
                abi: TRADER_VAULT_V4_ABI,
                functionName: 'redeem',
                args: [pos.marketAddress],
            });
            toast.loading('Redeeming shares...', { id: 'redeem' });
            if (publicClient) {
                await publicClient.waitForTransactionReceipt({ hash });
                toast.success('Shares redeemed!', { id: 'redeem' });
                refetch();
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
                <div className="absolute top-0 right-0 p-1 bg-slate-500/10 border-b border-l border-slate-500/20 rounded-bl-lg">
                    <Trophy size={8} className="text-slate-400" />
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
                            <span className="text-[10px] text-white font-mono">{(pos.liquidYes + pos.lockedYes + pos.walletYes).toFixed(2)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="text-[9px] font-bold text-emerald-400 font-mono">{formatCurrency((pos.liquidYes + pos.lockedYes + pos.walletYes) * priceYes)}</div>
                            <div className="flex gap-0.5 opacity-40">
                                {pos.walletYes > 0 && <Wallet size={7} className="text-emerald-400" />}
                                {pos.lockedYes > 0 && <Lock size={7} className="text-slate-400" />}
                                {pos.liquidYes > 0 && <ArrowRightLeft size={7} className="text-cyan-400" />}
                            </div>
                        </div>
                    </div>
                )}
                {hasNo && (
                    <div className="flex items-center justify-between p-1 rounded bg-rose-500/5 border border-rose-500/10">
                        <div className="flex items-center gap-1">
                            <span className="text-[8px] font-black px-1 py-0 rounded bg-rose-500 text-rose-950">NO</span>
                            <span className="text-[10px] text-white font-mono">{(pos.liquidNo + pos.lockedNo + pos.walletNo).toFixed(2)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="text-[9px] font-bold text-rose-400 font-mono">{formatCurrency((pos.liquidNo + pos.lockedNo + pos.walletNo) * priceNo)}</div>
                            <div className="flex gap-0.5 opacity-40">
                                {pos.walletNo > 0 && <Wallet size={7} className="text-rose-400" />}
                                {pos.lockedNo > 0 && <Lock size={7} className="text-slate-400" />}
                                {pos.liquidNo > 0 && <ArrowRightLeft size={7} className="text-cyan-400" />}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 gap-1.5 pt-1">
                {pos.isSettled ? (
                    <Button
                        onClick={handleRedeem}
                        disabled={isRedeeming}
                        variant="glow"
                        className="col-span-2 w-full py-2 text-[10px] font-black uppercase tracking-widest border border-cyan-500/30 text-cyan-400 transition-all flex items-center justify-center gap-1.5"
                    >
                        {isRedeeming ? <Loader2 size={10} className="animate-spin" /> : <Trophy size={10} />}
                        REDEEM WINNINGS
                    </Button>
                ) : (
                    <>
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setModalMode('merge')}
                            disabled={pos.liquidYes < 0.001 || pos.liquidNo < 0.001}
                            className="group py-2 text-[10px] font-black uppercase tracking-widest border border-slate-700 hover:border-slate-600 bg-slate-800/80 hover:bg-slate-700"
                        >
                            <GitMerge size={12} className="mr-1 opacity-70 group-hover:scale-110 transition-transform" /> MERGE
                        </Button>
                        <Button
                            size="sm"
                            variant="primary"
                            onClick={() => setModalMode('split')}
                            className="group py-2 text-[10px] font-black uppercase tracking-widest bg-cyan-600 hover:bg-cyan-500 border-none text-white"
                        >
                            <Scissors size={12} className="mr-1 opacity-70 group-hover:scale-110 transition-transform" /> SPLIT
                        </Button>
                    </>
                )}
            </div>

            <PositionActionsModal
                isOpen={modalMode !== null}
                onClose={() => setModalMode(null)}
                pos={pos}
                mode={modalMode || 'merge'}
                refetch={refetch}
            />
        </div>
    );
};

export const VaultPositionsCard: React.FC = () => {
    const { vaultPositions, isLoading, refetch } = useActivePositions();

    return (
        <PortfolioCard
            title="Trading Positions"
            icon={<ShieldCheck size={16} className="text-cyan-400" />}
            variant="indigo"
            badge={
                <span className="text-[9px] font-bold text-cyan-400/60 uppercase tracking-widest">
                    {vaultPositions.length} margin positions
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
            <div className="grid gap-2">
                {vaultPositions.map(pos => <PositionItem key={pos.id} pos={pos} refetch={refetch} />)}
            </div>
        </PortfolioCard>
    );
};
