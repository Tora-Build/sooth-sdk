import { useState } from 'react';
import { Activity } from 'lucide-react';

export const EarningsSimulator = ({ deposit }: { deposit: number }) => {
    const [volume, setVolume] = useState(100000); // Default $100k volume
    const feeRate = 0.05; // 5% pre-grad fee (V10 Spot-First)

    const estimatedEarnings = volume * feeRate;
    const roi = deposit > 0 ? (estimatedEarnings / deposit) * 100 : 0;

    return (
        <div className="mt-6 bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-5 border border-slate-700/50 shadow-inner">
            <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    Earnings Simulator
                </h4>
                <div className="text-[10px] text-slate-400 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                    Based on 5% Fee
                </div>
            </div>

            <div className="space-y-4">
                <div>
                    <div className="flex justify-between text-xs mb-2">
                        <span className="text-slate-400">Projected Trading Volume</span>
                        <span className="text-white font-mono">${volume.toLocaleString()}</span>
                    </div>
                    <input
                        type="range"
                        min="1000"
                        max="1000000"
                        step="1000"
                        value={volume}
                        onChange={(e) => setVolume(parseInt(e.target.value))}
                        className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                    <div className="flex justify-between text-[10px] text-slate-600 mt-1 font-mono">
                        <span>$1k</span>
                        <span>$1M</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-700/50">
                    <div>
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Your Deposit</p>
                        <p className="text-lg font-mono text-white">${deposit.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Est. Fees Earned</p>
                        <p className="text-lg font-mono text-emerald-400 font-bold">+${estimatedEarnings.toLocaleString()}</p>
                        <p className="text-[10px] text-emerald-500/70 font-mono">({roi.toFixed(1)}% ROI)</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
