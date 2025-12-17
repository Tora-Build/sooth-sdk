import React from 'react';
import { Card } from '../../ui/Card';
import { useAccount } from 'wagmi';
import { useActivePositions } from '../../../hooks/useActivePositions';
import { Sparkles, TrendingUp, Lock, ArrowRightLeft } from 'lucide-react';

export const ActivePositionsCard: React.FC = () => {
    const { isConnected } = useAccount();
    const { activePositions } = useActivePositions();

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

    const formatShares = (val: number) =>
        new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);

    const formatInteger = (val: number) =>
        new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(val);

    const formatTime = (ts: number | undefined) => {
        if (!ts) return '';
        const diff = ts - (Date.now() / 1000);
        if (diff <= 0) return '0m';
        if (diff < 3600) return `${Math.ceil(diff / 60)}m`;
        return `${(diff / 3600).toFixed(1)}h`;
    };

    if (!isConnected) {
        return (
            <Card className="h-full border-slate-800 bg-slate-900/50 p-6 flex flex-col items-center justify-center text-center backdrop-blur-sm">
                <Sparkles className="w-10 h-10 text-slate-700 mb-3" />
                <h3 className="text-sm font-medium text-slate-400">No Active Positions</h3>
                <p className="text-xs text-slate-500 mt-1">Connect wallet to view portfolio</p>
            </Card>
        );
    }

    const hasPositions = activePositions.length > 0;

    return (
        <Card className="h-full flex flex-col border-slate-700/50 bg-slate-900/60 backdrop-blur-xl shadow-2xl overflow-hidden relative">
            <div className="p-5 flex-1 flex flex-col relative z-10">
                <div className="flex justify-between items-center mb-4">
                    <div className="text-xs text-slate-400 uppercase tracking-widest font-bold flex items-center gap-2">
                        <TrendingUp size={14} /> Active Positions ({activePositions.length})
                    </div>
                </div>

                <div className="space-y-4 overflow-y-auto pr-1 custom-scrollbar flex-1">
                    {!hasPositions ? (
                        <div className="flex-1 flex flex-col justify-center items-center p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                                {/* AMM Venue */}
                                <div className="group p-4 rounded-xl bg-gradient-to-br from-teal-500/10 via-emerald-500/5 to-transparent border border-teal-500/20 hover:border-teal-500/40 transition-all">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="p-2 rounded-lg bg-teal-500/20 text-teal-400 group-hover:scale-110 transition-transform">
                                            <Sparkles size={18} />
                                        </div>
                                        <h3 className="font-bold text-teal-100">AMM Pool</h3>
                                    </div>
                                    <ul className="space-y-2 text-xs text-slate-400">
                                        <li className="flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-teal-500/50" />
                                            Instant Execution
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-teal-500/50" />
                                            Always Liquid (LMSR)
                                        </li>
                                        <li className="flex items-center gap-2 text-teal-300/80">
                                            <Lock size={10} />
                                            Sell proceeds locked 24h
                                        </li>
                                    </ul>
                                </div>

                                {/* Orderbook Venue */}
                                <div className="group p-4 rounded-xl bg-gradient-to-br from-indigo-500/10 via-violet-500/5 to-transparent border border-indigo-500/20 hover:border-indigo-500/40 transition-all">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400 group-hover:scale-110 transition-transform">
                                            <ArrowRightLeft size={18} />
                                        </div>
                                        <h3 className="font-bold text-indigo-100">Orderbook</h3>
                                    </div>
                                    <ul className="space-y-2 text-xs text-slate-400">
                                        <li className="flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500/50" />
                                            Set Your Price (Limit)
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500/50" />
                                            ERC1155 Token Ownership
                                        </li>
                                        <li className="flex items-center gap-2 text-indigo-300/80">
                                            <span className="text-[10px] font-bold border border-indigo-500/30 px-1 rounded">No Locks</span>
                                            Trade Any Time
                                        </li>
                                    </ul>
                                </div>
                            </div>
                            <p className="text-[10px] text-slate-600 mt-4 uppercase tracking-widest font-medium">Select a market to start trading</p>
                        </div>
                    ) : (
                        activePositions.map((pos) => {
                            const hasYes = (pos.liquidYes + pos.lockedYes) > 0.001;
                            const hasNo = (pos.liquidNo + pos.lockedNo) > 0.001;

                            // Prices (Fallback to 0.5)
                            const priceYes = pos.priceYes || 0.5;
                            const priceNo = 1 - priceYes;

                            const yesValue = (pos.liquidYes + pos.lockedYes) * priceYes;
                            const noValue = (pos.liquidNo + pos.lockedNo) * priceNo;

                            const isYesLocked = pos.lockedYes > 0 && pos.unlockTime && pos.unlockTime > Date.now() / 1000;
                            const isNoLocked = pos.lockedNo > 0 && pos.unlockTime && pos.unlockTime > Date.now() / 1000;

                            return (
                                <div key={pos.id} className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 hover:bg-slate-800/60 transition-colors group space-y-3">
                                    {/* Market Header */}
                                    <div className="flex justify-between items-start gap-2">
                                        <h4 className="font-semibold text-sm text-white leading-snug" title={pos.question}>
                                            {pos.question}
                                        </h4>
                                    </div>

                                    {/* Outcomes Container: Horizontal Layout */}
                                    <div className="flex flex-col md:flex-row gap-3">
                                        {/* YES Block */}
                                        {hasYes && (
                                            <div className="flex-1 rounded-lg border border-emerald-900/30 bg-emerald-950/20 overflow-hidden flex flex-col">
                                                {/* Outcome Header */}
                                                <div className="flex items-center justify-between px-3 py-2 bg-emerald-900/20 border-b border-emerald-900/30">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-500 text-emerald-950 shadow-sm shadow-emerald-500/20">
                                                            YES
                                                        </span>
                                                        <span className="text-xs text-emerald-100/70 font-mono">
                                                            {(priceYes * 100).toFixed(0)}%
                                                        </span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="font-mono text-sm font-bold text-emerald-400">{formatCurrency(yesValue)}</span>
                                                    </div>
                                                </div>

                                                {/* Holdings Breakdown: Grid inside the block */}
                                                <div className="grid grid-cols-2 divide-x divide-emerald-900/30 flex-1">
                                                    {/* Liquid / Orderbook */}
                                                    <div className="p-3 space-y-1">
                                                        <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                                                            <ArrowRightLeft size={10} />
                                                            <span className="uppercase tracking-wider font-semibold text-[10px]">Orderbook</span>
                                                        </div>
                                                        <div className="font-mono text-sm text-white">
                                                            {formatInteger(pos.liquidYes)}
                                                        </div>
                                                        <div className="text-[10px] text-emerald-400/80">
                                                            Liquid
                                                        </div>
                                                    </div>

                                                    {/* Locked / AMM */}
                                                    <div className="p-3 space-y-1 bg-emerald-900/5">
                                                        <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                                                            <Lock size={10} />
                                                            <span className="uppercase tracking-wider font-semibold text-[10px]">AMM Pool</span>
                                                        </div>
                                                        <div className="font-mono text-sm text-white">
                                                            {formatShares(pos.lockedYes)}
                                                        </div>
                                                        {pos.lockedYes > 0 ? (
                                                            <div className={`text-[10px] ${isYesLocked ? 'text-amber-400' : 'text-slate-500'}`}>
                                                                {isYesLocked ? `in ${formatTime(pos.unlockTime)}` : 'Unlocked'}
                                                            </div>
                                                        ) : (
                                                            <div className="text-[10px] text-slate-600">None</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* NO Block */}
                                        {hasNo && (
                                            <div className="flex-1 rounded-lg border border-rose-900/30 bg-rose-950/20 overflow-hidden flex flex-col">
                                                {/* Outcome Header */}
                                                <div className="flex items-center justify-between px-3 py-2 bg-rose-900/20 border-b border-rose-900/30">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-rose-500 text-rose-950 shadow-sm shadow-rose-500/20">
                                                            NO
                                                        </span>
                                                        <span className="text-xs text-rose-100/70 font-mono">
                                                            {(priceNo * 100).toFixed(0)}%
                                                        </span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="font-mono text-sm font-bold text-rose-400">{formatCurrency(noValue)}</span>
                                                    </div>
                                                </div>

                                                {/* Holdings Breakdown */}
                                                <div className="grid grid-cols-2 divide-x divide-rose-900/30 flex-1">
                                                    {/* Liquid / Orderbook */}
                                                    <div className="p-3 space-y-1">
                                                        <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                                                            <ArrowRightLeft size={10} />
                                                            <span className="uppercase tracking-wider font-semibold text-[10px]">Orderbook</span>
                                                        </div>
                                                        <div className="font-mono text-sm text-white">
                                                            {formatInteger(pos.liquidNo)}
                                                        </div>
                                                        <div className="text-[10px] text-rose-400/80">
                                                            Liquid
                                                        </div>
                                                    </div>

                                                    {/* Locked / AMM */}
                                                    <div className="p-3 space-y-1 bg-rose-900/5">
                                                        <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                                                            <Lock size={10} />
                                                            <span className="uppercase tracking-wider font-semibold text-[10px]">AMM Pool</span>
                                                        </div>
                                                        <div className="font-mono text-sm text-white">
                                                            {formatShares(pos.lockedNo)}
                                                        </div>
                                                        {pos.lockedNo > 0 ? (
                                                            <div className={`text-[10px] ${isNoLocked ? 'text-amber-400' : 'text-slate-500'}`}>
                                                                {isNoLocked ? `in ${formatTime(pos.unlockTime)}` : 'Unlocked'}
                                                            </div>
                                                        ) : (
                                                            <div className="text-[10px] text-slate-600">None</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </Card>
    );
};
