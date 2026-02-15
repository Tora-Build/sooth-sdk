import React, { useState, useMemo } from 'react';
import { useActivePositions, ActivePosition } from '../../../hooks/useActivePositions';
import { GitMerge, Scissors, ArrowUpRight, ArrowDownLeft, ChevronDown } from 'lucide-react';
import { useAccount } from 'wagmi';
import toast from 'react-hot-toast';
import { Dialog } from '../../ui/Dialog';
import { Input } from '../../ui/Input';
import { Button } from '../../ui/Button';
import { useTraderVault } from '../../../hooks/useTraderVault';
import { formatUnits } from 'viem';
import { useLaunchpadMarkets } from '../../../hooks/useLaunchpadMarkets';
import { cn } from '../../../lib/utils';

export const PositionActionsModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    pos?: ActivePosition;
    marketId?: string;
    mode: 'merge' | 'split';
    refetch: () => void;
}> = ({ isOpen, onClose, pos, marketId, mode, refetch }) => {
    const { address } = useAccount();
    const { availableBalance, decimals, refetch: refetchVault } = useTraderVault();
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

    // For Merge: Use vault (custodial) shares - liquidYes/liquidNo
    // For Split: Use vault USDC balance
    const available = mode === 'merge' 
        ? (activeMarket ? Math.min(activeMarket.liquidYes || 0, activeMarket.liquidNo || 0) : 0)
        : parseFloat(formatUnits(availableBalance, decimals || 18));

    const handleAction = async () => {
        if (!amount || parseFloat(amount) <= 0 || !activeMarket || !address) return;
        setIsLoading(true);
        const toastId = mode === 'merge' ? 'merge' : 'split';

        try {
            toast.loading('Action unavailable in V12 (no vault).', { id: toastId });
            await Promise.resolve();
            toast.success('No action executed.', { id: toastId });
            refetch();
            refetchVault();

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
                        <ArrowDownLeft size={16} className="text-cyan-400" />
                    )}
                    <span>{mode === 'merge' ? 'Merge Shares' : 'Split USDC'}</span>
                </div>
            }
        >
            <div className="space-y-4 pt-4">
                {!pos && !marketId && mode === 'split' && (
                    <div className="space-y-1.5">
                        <label className="text-xs text-slate-500 font-bold uppercase tracking-wider ml-1">Target Market</label>
                        <div className="relative">
                            <select 
                                className="w-full h-10 bg-slate-900 border border-slate-800 rounded-lg px-3 text-xs text-white appearance-none focus:border-cyan-500/50 outline-none pr-10"
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
                        : "bg-cyan-500/5 border-cyan-500/10"
                )}>
                    <div className="flex justify-between items-center mb-2">
                        <div className={cn(
                            "text-xs uppercase tracking-widest font-bold flex items-center gap-1.5",
                            mode === 'merge' ? "text-emerald-400/60" : "text-cyan-400/60"
                        )}>
                            {mode === 'merge' ? <GitMerge size={10} /> : <Scissors size={10} />}
                            {mode === 'merge' ? 'Collapsible Position' : 'Leveraged Exposure'}
                        </div>
                        <div className="text-xs text-white font-mono font-bold">
                            {mode === 'merge' ? '1 SET → $1.00' : '$1.00 → 1 SET'}
                        </div>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                        {mode === 'merge' ? (
                            <>Converts <span className="text-emerald-400 font-bold">1 YES + 1 NO</span> from your Trading Account into <span className="text-white font-bold">$1.00 USDC</span> (credited to Trading Account).</>
                        ) : (
                            <>Converts <span className="text-white font-bold">$1.00 USDC</span> from your Trading Account into <span className="text-cyan-400 font-bold">1 YES + 1 NO</span> shares (deposited to Trading Account).</>
                        )}
                    </p>
                </div>


                <div className="space-y-1.5">
                    <div className="relative">
                        <Input
                            placeholder="0"
                            value={amount}
                            onChange={(e) => {
                                // Enforce integer-only for both split and merge (shares are integers)
                                const intVal = Math.floor(parseFloat(e.target.value) || 0);
                                setAmount(intVal > 0 ? intVal.toString() : '');
                            }}
                            type="number"
                            step="1"
                            className={cn(
                                "pr-16 font-mono",
                                mode === 'merge' ? "focus:border-emerald-500/50" : "focus:border-cyan-500/50"
                            )}
                            disabled={!activeMarket}
                        />
                        <button
                            onClick={() => setAmount(Math.floor(available).toString())}
                            className={cn(
                                "absolute right-2 top-2 px-2 py-1 bg-slate-800 text-xs rounded hover:bg-slate-700 font-bold transition-colors disabled:opacity-50",
                                mode === 'merge' ? "text-emerald-400" : "text-cyan-400"
                            )}
                            disabled={!activeMarket}
                        >
                            MAX
                        </button>
                    </div>
                    <div className="flex justify-between items-center px-1">
                        <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                            {mode === 'merge' ? 'In Trading Account' : 'USDC in Trading Account'}
                        </span>
                        <span className={cn(
                            "text-xs font-mono font-bold",
                            mode === 'merge' ? "text-emerald-400" : "text-cyan-400"
                        )}>
                            {mode === 'merge' ? `${Math.floor(available)} SETS` : `$${Math.floor(available).toLocaleString()}`}
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
                            : "bg-cyan-600 hover:bg-cyan-500 border-none text-white"
                    )}
                >
                    {mode === 'merge' ? 'Confirm Merge' : 'Confirm Split'}
                </Button>
            </div>
        </Dialog>
    );
};
