import { HelpCircle, X, Rocket } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../../lib/utils';
import { Link } from 'react-router-dom';

export const LaunchpadHeader = () => {
    const [showHint, setShowHint] = useState(false);

    return (
        <div className="space-y-4 mb-8">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
                        <Rocket className="w-6 h-6" />
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Launchpad</h1>
                    <button
                        onClick={() => setShowHint(!showHint)}
                        className={cn(
                            "p-1.5 rounded-lg transition-all",
                            showHint
                                ? "bg-slate-700 text-white"
                                : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
                        )}
                    >
                        {showHint ? <X className="w-4 h-4" /> : <HelpCircle className="w-4 h-4" />}
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <Link to="/trade" className="text-sm font-bold text-slate-400 hover:text-white transition-colors">
                        Cancel
                    </Link>
                </div>
            </div>

            {showHint && (
                <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800 text-sm text-slate-400 leading-relaxed animate-in fade-in slide-in-from-top-1">
                    Launch a verifiable truth market in seconds. By depositing initial liquidity (USDC), you seed both the <strong>Orderbook</strong> and <strong>AMM</strong> with "Spot-First" liquidity, earning 5% fees on early volume.
                </div>
            )}
        </div>
    );
};
