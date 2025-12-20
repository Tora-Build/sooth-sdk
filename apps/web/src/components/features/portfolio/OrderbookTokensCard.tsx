import React, { useState, useMemo } from 'react';
import { useActivePositions, ActivePosition } from '../../../hooks/useActivePositions';
import { Wallet, Coins, Trophy, Loader2, GitMerge, Scissors, ArrowUpRight, ArrowDownLeft, ChevronDown } from 'lucide-react';
import { formatCurrency } from '../../../utils/format';
import { cn } from '../../../lib/utils';
import { useWriteContract, usePublicClient, useAccount } from 'wagmi';
import { TRADER_VAULT_V4_ABI } from '../../../config/abis';
import toast from 'react-hot-toast';
import { PortfolioCard } from './PortfolioCard';
import { Dialog } from '../../ui/Dialog';
import { Input } from '../../ui/Input';
import { Button } from '../../ui/Button';
import { useTraderVault } from '../../../hooks/useTraderVault';
import { parseUnits, formatUnits } from 'viem';
import { useLaunchpadMarkets } from '../../../hooks/v5/useLaunchpadMarkets';

export const PositionActionsModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    pos?: ActivePosition;
    marketId?: string;
    mode: 'merge' | 'split';
    refetch: () => void;
}> = ({ isOpen, onClose, pos, marketId, mode, refetch }) => {
    const { address } = useAccount();
    const { writeContractAsync } = useWriteContract();
    const publicClient = usePublicClient();
    const { availableBalance, decimals, refetch: refetchVault, traderVaultAddress } = useTraderVault();
    const { markets } = useLaunchpadMarkets();
    const { vaultPositions } = useActivePositions();
    
    const [selectedMarketAddr, setSelectedMarketAddr] = useState<`0x${string}` | null>(null);
    const [amount, setAmount] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // If marketId is provided, use it to find the market
    const explicitMarket = marketId ? markets.find(m => m.address.toLowerCase() === marketId.toLowerCase()) : null;

    // Find if we have an active position for this market in the vault (custodial)
    const activeVaultPos = useMemo(() => {
        const addr = marketId || selectedMarketAddr;
        if (!addr) return null;
        return vaultPositions.find(p => p.marketAddress.toLowerCase() === addr.toLowerCase());
    }, [vaultPositions, marketId, selectedMarketAddr]);

    // If pos is provided, use it. Otherwise use activeVaultPos, explicit market or selected market from dropdown.
    // For Merge/Split from Trading Account, we use vault (custodial) positions
    const activeMarket = pos || activeVaultPos || (explicitMarket ? {
        outcomeTokenAddress: explicitMarket.outcomeToken,
        marketAddress: explicitMarket.address as `0x${string}`,
        liquidYes: 0,
        liquidNo: 0,
        question: explicitMarket.name || 'Current Market'
    } : (selectedMarketAddr ? {
        outcomeTokenAddress: markets.find(m => m.address === selectedMarketAddr)?.outcomeToken,
        marketAddress: selectedMarketAddr,
        liquidYes: 0,
        liquidNo: 0,
        question: markets.find(m => m.address === selectedMarketAddr)?.name || 'Selected Market'
    } : null));

    // Note: Contract has dynamic token authorization via onlyOutcomeToken modifier
    // It checks if the caller's market() is a valid market in LaunchpadFactory
    // No client-side safeguard needed - let the contract handle authorization

    // For Merge: Use vault (custodial) shares - liquidYes/liquidNo
    // For Split: Use vault USDC balance
    const available = mode === 'merge' 
        ? (activeMarket ? Math.min(activeMarket.liquidYes || 0, activeMarket.liquidNo || 0) : 0)
        : parseFloat(availableBalance.toString()) / (10 ** (decimals || 6));

    const handleAction = async () => {
        if (!amount || parseFloat(amount) <= 0 || !activeMarket || !publicClient || !address) return;
        setIsLoading(true);
        const toastId = mode === 'merge' ? 'merge' : 'split';
        
        const marketAddr = activeMarket.marketAddress as `0x${string}`;
        
        try {
            let finalAmountBig: bigint;
            
            if (mode === 'merge') {
                // Merge: Atomic via mergeFromVault (1 transaction)
                const liqYes = activeMarket.liquidYes || 0;
                const liqNo = activeMarket.liquidNo || 0;
                const maxMerge = Math.min(liqYes, liqNo);
                
                if (parseFloat(amount) >= maxMerge) {
                    finalAmountBig = parseUnits(maxMerge.toString(), 18);
                } else {
                    finalAmountBig = parseUnits(amount, 18);
                }
                
                if (finalAmountBig === 0n) throw new Error("No shares available to merge");
                
                toast.loading('Merging shares...', { id: toastId });
                const hash = await writeContractAsync({
                    address: traderVaultAddress,
                    abi: TRADER_VAULT_V4_ABI,
                    functionName: 'mergeFromVault',
                    args: [marketAddr, finalAmountBig],
                });
                await publicClient.waitForTransactionReceipt({ hash });
                
                toast.success('Shares merged! USDC credited to account.', { id: toastId });
                
            } else {
                // Split: Atomic via splitAndDeposit (1 transaction)
                const scalar = BigInt(10 ** (18 - (decimals || 6)));
                const maxSplitWad = availableBalance * scalar;
                const availableSplit = parseFloat(formatUnits(availableBalance, decimals || 6));
                
                if (parseFloat(amount) >= availableSplit) {
                    finalAmountBig = maxSplitWad;
                } else {
                    finalAmountBig = parseUnits(amount, 18);
                }
                
                if (finalAmountBig === 0n) throw new Error("Amount is 0");
                
                toast.loading('Splitting USDC into shares...', { id: toastId });
                const hash = await writeContractAsync({
                    address: traderVaultAddress,
                    abi: TRADER_VAULT_V4_ABI,
                    functionName: 'splitAndDeposit',
                    args: [marketAddr, finalAmountBig],
                });
                await publicClient.waitForTransactionReceipt({ hash });
                
                toast.success('USDC split! Shares deposited to account.', { id: toastId });
            }
            
            // Refetch data
            const triggers = [0, 1000, 3000, 5000];
            triggers.forEach(delay => {
                setTimeout(() => {
                    refetch();
                    refetchVault();
                }, delay);
            });

            onClose();
        } catch (e: any) {
            toast.error(e.message?.split('\n')[0] || `${mode === 'merge' ? 'Merge' : 'Split'} failed`, { id: toastId });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog 
            isOpen={isOpen} 
            onClose={onClose} 
            title={
                <div className="flex items-center gap-2">
                    {mode === 'merge' ? (
                        <ArrowUpRight size={16} className="text-emerald-400" />
                    ) : (
                        <ArrowDownLeft size={16} className="text-indigo-400" />
                    )}
                    <span>{mode === 'merge' ? 'Merge Shares' : 'Split USDC'}</span>
                </div>
            }
        >
            <div className="space-y-4 pt-4">
                {!pos && !marketId && mode === 'split' && (
                    <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider ml-1">Target Market</label>
                        <div className="relative">
                            <select 
                                className="w-full h-10 bg-slate-900 border border-slate-800 rounded-lg px-3 text-xs text-white appearance-none focus:border-indigo-500/50 outline-none pr-10"
                                value={selectedMarketAddr || ''}
                                onChange={(e) => setSelectedMarketAddr(e.target.value as `0x${string}`)}
                            >
                                <option value="" disabled>Select market to split...</option>
                                {markets.map(m => (
                                    <option key={m.address} value={m.address}>{m.name}</option>
                                ))}
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-3 text-slate-500 pointer-events-none" />
                        </div>
                    </div>
                )}

                <div className={cn(
                    "p-3 rounded-lg border backdrop-blur-md",
                    mode === 'merge' 
                        ? "bg-emerald-500/5 border-emerald-500/10" 
                        : "bg-indigo-500/5 border-indigo-500/10"
                )}>
                    <div className="flex justify-between items-center mb-2">
                        <div className={cn(
                            "text-[10px] uppercase tracking-widest font-bold flex items-center gap-1.5",
                            mode === 'merge' ? "text-emerald-400/60" : "text-indigo-400/60"
                        )}>
                            {mode === 'merge' ? <GitMerge size={10} /> : <Scissors size={10} />}
                            {mode === 'merge' ? 'Collapsible Position' : 'Leveraged Exposure'}
                        </div>
                        <div className="text-[10px] text-white font-mono font-bold">
                            {mode === 'merge' ? '1 SET → $1.00' : '$1.00 → 1 SET'}
                        </div>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                        {mode === 'merge' ? (
                            <>Converts <span className="text-emerald-400 font-bold">1 YES + 1 NO</span> from your Trading Account into <span className="text-white font-bold">$1.00 USDC</span> (credited to Trading Account).</>
                        ) : (
                            <>Converts <span className="text-white font-bold">$1.00 USDC</span> from your Trading Account into <span className="text-indigo-400 font-bold">1 YES + 1 NO</span> shares (deposited to Trading Account).</>
                        )}
                    </p>
                </div>


                <div className="space-y-1.5">
                    <div className="relative">
                        <Input
                            placeholder="0.00"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            type="number"
                            className={cn(
                                "pr-16 font-mono",
                                mode === 'merge' ? "focus:border-emerald-500/50" : "focus:border-indigo-500/50"
                            )}
                            disabled={!activeMarket}
                        />
                        <button
                            onClick={() => setAmount(available.toString())}
                            className={cn(
                                "absolute right-2 top-2 px-2 py-1 bg-slate-800 text-[10px] rounded hover:bg-slate-700 font-bold transition-colors disabled:opacity-50",
                                mode === 'merge' ? "text-emerald-400" : "text-indigo-400"
                            )}
                            disabled={!activeMarket}
                        >
                            MAX
                        </button>
                    </div>
                    <div className="flex justify-between items-center px-1">
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                            {mode === 'merge' ? 'In Trading Account' : 'USDC in Trading Account'}
                        </span>
                        <span className={cn(
                            "text-[10px] font-mono font-bold",
                            mode === 'merge' ? "text-emerald-400" : "text-indigo-400"
                        )}>
                            {mode === 'merge' ? `${available.toFixed(2)} SETS` : formatCurrency(available)}
                        </span>
                    </div>
                </div>

                <Button 
                    onClick={handleAction} 
                    isLoading={isLoading}
                    disabled={!amount || parseFloat(amount) > (available + 0.000001) || !activeMarket} 
                    className={cn(
                        "w-full font-black py-2 uppercase tracking-widest text-sm",
                        mode === 'merge' 
                            ? "bg-slate-800 hover:bg-slate-700 border-slate-700" 
                            : "bg-indigo-600 hover:bg-indigo-500 border-none text-white"
                    )}
                >
                    {mode === 'merge' ? 'Confirm Merge' : 'Confirm Split'}
                </Button>
            </div>
        </Dialog>
    );
};

const PositionItem: React.FC<{ pos: ActivePosition; refetch: () => void }> = ({ pos, refetch }) => {
    const { writeContractAsync } = useWriteContract();
    const publicClient = usePublicClient();
    const { refetch: refetchVault } = useTraderVault();
    const [isRedeeming, setIsRedeeming] = useState(false);
    const [modalMode, setModalMode] = useState<'merge' | 'split' | null>(null);

    const hasYes = pos.walletYes > 0.001;
    const hasNo = pos.walletNo > 0.001;
    const priceYes = pos.priceYes || 0.5;
    const priceNo = 1 - priceYes;

    const handleQuickClaim = async () => {
        if (!pos.isSettled) return;
        setIsRedeeming(true);
        try {
            const yesBig = pos.walletYesBig || 0n;
            const noBig = pos.walletNoBig || 0n;
            const claimAmountBig = yesBig > noBig ? yesBig : noBig;
            if (claimAmountBig === 0n) return;
            const hash = await writeContractAsync({
                address: pos.outcomeTokenAddress || pos.marketAddress,
                abi: LAUNCHPAD_OUTCOME_TOKEN_ABI,
                functionName: 'merge',
                args: [claimAmountBig],
            });
            toast.loading('Claiming winnings...', { id: 'claim' });
            if (publicClient) {
                await publicClient.waitForTransactionReceipt({ hash });
                toast.success('Winnings claimed!', { id: 'claim' });
                refetch();
                refetchVault();
            }
        } catch (e: any) {
            toast.error(e.message?.split('\n')[0] || 'Claim failed', { id: 'claim' });
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

            <h4 className="font-bold text-[11px] text-white leading-tight truncate pr-4" title={pos.question}>
                {pos.question}
            </h4>

            <div className="flex flex-col gap-1">
                {hasYes && (
                    <div className="flex items-center justify-between p-1 rounded bg-emerald-500/5 border border-emerald-500/10">
                        <div className="flex items-center gap-1">
                            <span className="text-[8px] font-black px-1 py-0 rounded bg-emerald-500 text-emerald-950">YES</span>
                            <span className="text-[10px] text-white font-mono">{pos.walletYes.toFixed(2)}</span>
                        </div>
                        <div className="text-[9px] font-bold text-emerald-400 font-mono">{formatCurrency(pos.walletYes * priceYes)}</div>
                    </div>
                )}
                {hasNo && (
                    <div className="flex items-center justify-between p-1 rounded bg-rose-500/5 border border-rose-500/10">
                        <div className="flex items-center gap-1">
                            <span className="text-[8px] font-black px-1 py-0 rounded bg-rose-500 text-rose-950">NO</span>
                            <span className="text-[10px] text-white font-mono">{pos.walletNo.toFixed(2)}</span>
                        </div>
                        <div className="text-[9px] font-bold text-rose-400 font-mono">{formatCurrency(pos.walletNo * priceNo)}</div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 gap-1.5 pt-1">
                {pos.isSettled ? (
                    <Button
                        size="xs"
                        variant="glow"
                        onClick={handleQuickClaim}
                        isLoading={isRedeeming}
                        className="col-span-2 h-7 text-[9px] font-black uppercase tracking-widest border border-amber-500/30"
                    >
                        <Trophy size={10} className="mr-1.5" />
                        CLAIM WINNINGS
                    </Button>
                ) : (
                    <>
                        <Button
                            size="xs"
                            variant="secondary"
                            onClick={() => setModalMode('merge')}
                            disabled={pos.walletYes < 0.001 || pos.walletNo < 0.001}
                            className="group h-7 text-[9px] font-black uppercase tracking-widest border border-slate-700 hover:border-slate-600 bg-slate-800/80 hover:bg-slate-700"
                        >
                            <ArrowUpRight size={10} className="mr-1 opacity-70 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" /> MERGE
                        </Button>
                        <Button
                            size="xs"
                            variant="primary"
                            onClick={() => setModalMode('split')}
                            className="group h-7 text-[9px] font-black uppercase tracking-widest bg-indigo-600 hover:bg-indigo-500 border-none text-white"
                        >
                            <ArrowDownLeft size={10} className="mr-1 opacity-70 group-hover:-translate-x-0.5 group-hover:translate-y-0.5 transition-transform" /> SPLIT
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

export const OrderbookTokensCard: React.FC = () => {
    const { walletPositions, walletValue, isLoading, refetch } = useActivePositions();

    return (
        <PortfolioCard
            title="Orderbook Tokens"
            icon={<Coins size={16} className="text-indigo-400" />}
            variant="indigo"
            badge={
                <div className="text-xs font-black text-indigo-400 font-mono">
                    {isLoading && walletPositions.length === 0 ? '--' : formatCurrency(walletValue)}
                </div>
            }
            itemCount={walletPositions.length}
            isLoading={isLoading && walletPositions.length === 0}
            emptyState={
                <div className="py-6 text-center flex flex-col items-center justify-center opacity-40">
                    <Coins size={24} className="text-slate-600 mb-1" />
                    <p className="text-[10px] font-mono">// no_onchain_tokens</p>
                </div>
            }
        >
            <div className="grid gap-2">
                {walletPositions.map(pos => <PositionItem key={pos.id} pos={pos} refetch={refetch} />)}
            </div>
        </PortfolioCard>
    );
};
