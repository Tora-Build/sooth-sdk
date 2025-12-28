import React from 'react';
import { cn } from '../../../../lib/utils';
import { GlassPanel, PanelHeader } from './ui-components';
import { TrendingUp, RefreshCw } from 'lucide-react';

interface TickRowProps {
    price: number;
    size: bigint;
    cumulative: bigint;
    maxSize: bigint;
    side: 'bid' | 'ask';
    onClick: () => void;
}

const TickRow: React.FC<TickRowProps> = ({ price, size, cumulative, maxSize, side, onClick }) => {
    const sizeNum = Number(size) / 1e18;
    const cumulativeNum = Number(cumulative) / 1e18;
    const ratio = maxSize > 0n ? Number((size * 100n) / maxSize) : 0;

    return (
        <div
            onClick={onClick}
            className="relative grid grid-cols-12 gap-2 px-3 py-0.5 text-xs font-mono cursor-pointer hover:bg-slate-800/60 group transition-colors"
        >
            {/* Depth Bar */}
            <div
                className={cn(
                    "absolute top-0 bottom-0 right-0 opacity-15 transition-all duration-300",
                    side === 'ask' ? "bg-rose-500" : "bg-emerald-500"
                )}
                style={{ width: `${Math.min(ratio, 100)}%` }}
            />

            {/* Data */}
            <span className={cn(
                "col-span-4 text-left tabular-nums font-medium relative z-10",
                side === 'ask' ? "text-rose-400 group-hover:text-rose-300" : "text-emerald-400 group-hover:text-emerald-300"
            )}>
                {(price * 100).toFixed(2)}<span className="opacity-50">%</span>
            </span>
            <span className="col-span-4 text-right text-slate-400 group-hover:text-slate-200 tabular-nums relative z-10">
                {sizeNum.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
            <span className="col-span-4 text-right text-slate-600 group-hover:text-slate-400 tabular-nums relative z-10">
                {cumulativeNum.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
        </div>
    );
};

interface OrderbookProps {
    bids: Array<{ index: number; price: number; yesDepth: bigint; noDepth: bigint }>;
    asks: Array<{ index: number; price: number; yesDepth: bigint; noDepth: bigint }>;
    currentTick: number;
    isLoading: boolean;
    onRefresh: () => void;
    onTickClick: (price: number, side: 'buy' | 'sell') => void;
}

export const Orderbook: React.FC<OrderbookProps> = ({
    bids, asks, currentTick, isLoading, onRefresh, onTickClick
}) => {
    // Process depths
    const maxBidSize = bids.reduce((max, t) => t.noDepth > max ? t.noDepth : max, 0n);
    const maxAskSize = asks.reduce((max, t) => t.yesDepth > max ? t.yesDepth : max, 0n);
    const maxSize = maxBidSize > maxAskSize ? maxBidSize : maxAskSize;

    let bidCumulative = 0n;
    const bidsWithCum = bids.map(t => { bidCumulative += t.noDepth; return { ...t, cumulative: bidCumulative }; });

    let askCumulative = 0n;
    const asksWithCum = [...asks].reverse().map(t => { askCumulative += t.yesDepth; return { ...t, cumulative: askCumulative }; }).reverse();

    return (
        <GlassPanel className="flex-1 flex flex-col min-h-0">
            <PanelHeader
                title="ORDER BOOK"
                icon={TrendingUp}
                action={<button onClick={onRefresh}><RefreshCw className={cn("w-4 h-4 text-slate-500 hover:text-white transition-colors", isLoading && "animate-spin")} /></button>}
            />

            {/* Column Headers */}
            <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[10px] font-mono text-slate-500 uppercase tracking-wider border-b border-slate-800">
                <span className="col-span-4 pl-1">Price (Prob)</span>
                <span className="col-span-4 text-right">Size (Shares)</span>
                <span className="col-span-4 text-right pr-1">Total</span>
            </div>

            {/* Asks (Sell) */}
            <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col-reverse min-h-0">
                {asksWithCum.map(t => (
                    <TickRow key={t.index} price={t.price} size={t.yesDepth} cumulative={t.cumulative} maxSize={maxSize} side="ask" onClick={() => onTickClick(t.price, 'sell')} />
                ))}
            </div>

            {/* Spread Indicator */}
            <div className="py-1.5 bg-slate-900 border-y border-slate-800 flex items-center justify-between px-4 font-mono text-xs">
                <span className="text-slate-500">Spread</span>
                <span className="text-amber-400 font-bold">{asks.length && bids.length ? ((asks[0].index - bids[0].index) / 10).toFixed(1) : '0.0'}%</span>
                <span className="text-slate-500">Mid: {((currentTick / 1000) * 100).toFixed(1)}%</span>
            </div>

            {/* Bids (Buy) */}
            <div className="flex-1 overflow-y-auto no-scrollbar min-h-0">
                {bidsWithCum.map(t => (
                    <TickRow key={t.index} price={t.price} size={t.noDepth} cumulative={t.cumulative} maxSize={maxSize} side="bid" onClick={() => onTickClick(t.price, 'buy')} />
                ))}
            </div>
        </GlassPanel>
    );
};
