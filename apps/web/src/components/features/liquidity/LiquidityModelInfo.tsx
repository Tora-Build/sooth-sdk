import React from 'react';
import { Card } from '../../ui/Card';
import { Plus, Equal, Lock, ArrowRight } from 'lucide-react';

export const LiquidityModelInfo: React.FC = () => {
  return (
    <Card className="bg-slate-900/40 border-slate-800">
      <h3 className="font-heading font-bold text-lg text-white mb-6">How Liquidity Works</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 items-center relative">
        {/* Step 1: Base */}
        <div className="relative p-5 rounded-xl bg-slate-800/30 border border-slate-700/50 text-center group hover:border-blue-500/30 transition-colors">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-2">From Vault</div>
          <div className="text-lg font-bold text-white mb-1">Base Depth</div>
          <div className="text-xs text-slate-500 leading-relaxed">
            <span className="text-blue-400 font-medium">b_base</span> allocated<br />to each market
          </div>
          <div className="absolute top-1/2 -right-6 hidden md:flex items-center justify-center w-8 h-8 rounded-full bg-slate-900 border border-slate-800 text-slate-500 z-10">
            <Plus className="w-4 h-4" />
          </div>
        </div>

        {/* Step 2: Reserves */}
        <div className="relative p-5 rounded-xl bg-slate-800/30 border border-slate-700/50 text-center group hover:border-emerald-500/30 transition-colors">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-2">From Trading</div>
          <div className="text-lg font-bold text-white mb-1">Market PnL</div>
          <div className="text-xs text-slate-500 leading-relaxed">
            <span className="text-emerald-400 font-medium">reserves × 10%</span><br />adds to depth
          </div>
          <div className="absolute top-1/2 -right-6 hidden md:flex items-center justify-center w-8 h-8 rounded-full bg-slate-900 border border-slate-800 text-slate-500 z-10">
            <Equal className="w-4 h-4" />
          </div>
        </div>

        {/* Step 3: Result */}
        <div className="p-5 rounded-xl bg-gradient-to-br from-indigo-900/20 to-slate-900/50 border border-indigo-500/30 text-center shadow-lg shadow-indigo-900/10">
          <div className="text-[10px] text-indigo-300 uppercase tracking-wider mb-2">Market Depth</div>
          <div className="text-2xl font-bold text-white mb-1">b</div>
          <div className="text-xs text-slate-400">
            Higher b → Lower slippage
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-800/50">
        <div className="flex gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 h-fit">
            <ArrowRight className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <strong className="text-white text-sm block mb-1">Growth Flywheel</strong>
            <p className="text-xs text-slate-400 leading-relaxed">
              Profitable markets accumulate reserves, which increases their depth (b), attracting more volume and more profits.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10 h-fit">
            <Lock className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <strong className="text-white text-sm block mb-1">Capital Locking</strong>
            <p className="text-xs text-slate-400 leading-relaxed">
              Vault locks <span className="font-mono text-amber-400">b × solvencyFactor</span> per market. At 50% odds: locks 69%. At 90%: only 32%.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-slate-800/50">
        <h4 className="font-heading font-semibold text-white mb-4 text-sm">Key Formulas</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-slate-800/20 border border-slate-700/30">
            <div className="font-mono text-xs text-blue-400 mb-1">b = b_base + (reserves × 1000 / 10000)</div>
            <div className="text-[10px] text-slate-500">Market depth = base + 10% of reserves</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-800/20 border border-slate-700/30">
            <div className="font-mono text-xs text-slate-400 mb-1">lockedExposure = b × solvencyFactor(p)</div>
            <div className="text-[10px] text-slate-500">Dynamic based on YES price (p)</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-800/20 border border-slate-700/30">
            <div className="font-mono text-xs text-amber-400 mb-1">solvencyFactor(p) = |p·ln(p) + (1-p)·ln(1-p)|</div>
            <div className="text-[10px] text-slate-500">Negative entropy: 0.693 at 50%, 0.325 at 90%</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-800/20 border border-slate-700/30">
            <div className="font-mono text-xs text-blue-400 mb-1">available = totalAssets − Σ(lockedExposure)</div>
            <div className="text-[10px] text-slate-500">Capital LPs can withdraw</div>
          </div>
        </div>
      </div>
    </Card>
  );
};
