import { useState } from 'react';
import { Gamepad2, ArrowRight, Sparkles, TrendingUp, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../../../lib/utils';

export const TraderBenefitsBanner = () => {
    const [showExample, setShowExample] = useState(false);

    return (
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-cyan-500/10">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            
            <div className="relative p-5">
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 shrink-0">
                        <Gamepad2 className="w-6 h-6 text-white" />
                    </div>
                    
                    <div className="flex-1 space-y-3">
                        <div>
                            <h3 className="text-lg font-black text-white flex items-center gap-2">
                                Not Just for Creators
                                <span className="text-emerald-400">— Traders Earn Too!</span>
                            </h3>
                            <p className="text-sm text-white/60 mt-1">
                                Pay fees, get ownership. Your 5% fee becomes LP tokens.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-sm">
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
                                <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center">
                                    <span className="text-xs">5%</span>
                                </div>
                                <ArrowRight className="w-4 h-4 text-white/30" />
                                <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                    <Sparkles className="w-3 h-3 text-emerald-400" />
                                </div>
                                <span className="text-white/70">Fee → LP Tokens</span>
                            </div>

                            <div className="flex items-center gap-2 text-white/50">
                                <TrendingUp className="w-4 h-4 text-emerald-400" />
                                <span>LP appreciates with volume</span>
                            </div>

                            <div className="flex items-center gap-2 text-white/50">
                                <Shield className="w-4 h-4 text-yellow-400" />
                                <span>Cushions losses</span>
                            </div>
                        </div>

                        <button
                            onClick={() => setShowExample(!showExample)}
                            className="flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
                        >
                            {showExample ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            {showExample ? "Hide example" : "See Alice's story"}
                        </button>

                        {showExample && (
                            <div className="p-4 rounded-xl bg-black/30 border border-white/10 space-y-3 animate-in fade-in slide-in-from-top-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-lg">🎮</span>
                                    <span className="font-bold text-white">Alice's Journey</span>
                                </div>

                                <div className="space-y-2 text-sm">
                                    <div className="flex items-start gap-3">
                                        <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                            <span className="text-xs text-violet-300">1</span>
                                        </div>
                                        <p className="text-white/70">
                                            Alice trades <span className="text-white font-bold">$200</span> on YES during pre-graduation
                                        </p>
                                    </div>

                                    <div className="flex items-start gap-3">
                                        <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                            <span className="text-xs text-violet-300">2</span>
                                        </div>
                                        <p className="text-white/70">
                                            Pays <span className="text-white font-bold">$10 fee</span> (5%) → Receives <span className="text-emerald-400 font-bold">$10 LP tokens</span>
                                        </p>
                                    </div>

                                    <div className="flex items-start gap-3">
                                        <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                            <span className="text-xs text-violet-300">3</span>
                                        </div>
                                        <p className="text-white/70">
                                            Market generates <span className="text-white font-bold">$50k volume</span> → LP tokens now worth <span className="text-emerald-400 font-bold">$70</span>
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 pt-2">
                                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                                        <p className="text-[10px] text-red-300 uppercase font-bold">If Alice is WRONG</p>
                                        <div className="mt-2 space-y-1 text-sm">
                                            <p className="text-white/50">Prediction: <span className="text-red-400">-$200</span></p>
                                            <p className="text-white/50">LP Value: <span className="text-emerald-400">+$70</span></p>
                                            <p className="text-white font-bold border-t border-white/10 pt-1 mt-1">
                                                Net: <span className="text-yellow-400">-$130</span>
                                            </p>
                                            <p className="text-[10px] text-yellow-400">35% loss recovered!</p>
                                        </div>
                                    </div>

                                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                        <p className="text-[10px] text-emerald-300 uppercase font-bold">If Alice is RIGHT</p>
                                        <div className="mt-2 space-y-1 text-sm">
                                            <p className="text-white/50">Prediction: <span className="text-emerald-400">+$200</span></p>
                                            <p className="text-white/50">LP Value: <span className="text-emerald-400">+$70</span></p>
                                            <p className="text-white font-bold border-t border-white/10 pt-1 mt-1">
                                                Net: <span className="text-emerald-400">+$270</span>
                                            </p>
                                            <p className="text-[10px] text-emerald-400">LP investment pays off!</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 text-xs text-emerald-300">
                                    <Sparkles className="w-4 h-4" />
                                    <span><span className="font-bold">Key:</span> Alice has asymmetric upside — she can profit even when wrong!</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
