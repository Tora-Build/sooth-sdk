import React from 'react';
import { GlassPanel, PanelHeader } from './ui-components';
import { Clock } from 'lucide-react';
import { formatUnits } from 'viem';

interface Trade {
    id: string;
    side: 'buy' | 'sell';
    price: number;
    size: bigint;
    timestamp: number;
    hash: string;
}

// Mock Data until backend is ready
const MOCK_TRADES: Trade[] = [
    { id: '1', side: 'buy', price: 55.45, size: 100000000000000000000n, timestamp: Date.now() - 1000 * 60 * 5, hash: '0x123...' },
    { id: '2', side: 'sell', price: 56.10, size: 50000000000000000000n, timestamp: Date.now() - 1000 * 60 * 30, hash: '0x456...' },
    { id: '3', side: 'buy', price: 54.90, size: 250000000000000000000n, timestamp: Date.now() - 1000 * 60 * 60, hash: '0x789...' },
];

export const UserHistory: React.FC = () => {
    return (
        <GlassPanel className="flex-1 flex flex-col min-h-0">
            <PanelHeader title="RECENT TRADES (MOCK)" icon={Clock} />

            <div className="grid grid-cols-4 gap-2 px-4 py-2 text-[10px] font-mono text-slate-500 uppercase tracking-wider border-b border-slate-800">
                <span>Time</span>
                <span>Type</span>
                <span className="text-right">Price</span>
                <span className="text-right">Size</span>
            </div>

            <div className="flex-1 overflow-y-auto">
                {MOCK_TRADES.map((trade) => (
                    <div key={trade.id} className="grid grid-cols-4 gap-2 px-4 py-2 text-xs font-mono border-b border-slate-800/50 hover:bg-slate-800/30">
                        <span className="text-slate-400">
                            {new Date(trade.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className={trade.side === 'buy' ? 'text-emerald-400 uppercase font-bold' : 'text-rose-400 uppercase font-bold'}>
                            {trade.side}
                        </span>
                        <span className="text-right text-slate-200">
                            {trade.price.toFixed(2)}%
                        </span>
                        <span className="text-right text-slate-400">
                            {formatUnits(trade.size, 18).split('.')[0]}
                        </span>
                    </div>
                ))}
            </div>
        </GlassPanel>
    );
};
