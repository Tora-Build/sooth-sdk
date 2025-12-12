import React from 'react';
import { Card } from '../../ui/Card';
import { Plus, Equal, Lock, ArrowRight } from 'lucide-react';

export const LiquidityModelInfo: React.FC = () => {
  return (
    <Card className="bg-slate-900/40 border-slate-800">
      <h3 className="font-heading font-bold text-lg text-white mb-6">Hybrid Liquidity Model</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 items-center relative">
        {/* Step 1: Base */}
        <div className="relative p-5 rounded-xl bg-slate-800/30 border border-slate-700/50 text-center group hover:border-blue-500/30 transition-colors">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-2">Source 1</div>
          <div className="text-lg font-bold text-white mb-1">Global Vault</div>
          <div className="text-xs text-slate-500 leading-relaxed">
            Allocates <span className="text-blue-400 font-medium">Base Liquidity</span><br/>to every market
          </div>
          <div className="absolute top-1/2 -right-6 hidden md:flex items-center justify-center w-8 h-8 rounded-full bg-slate-900 border border-slate-800 text-slate-500 z-10">
            <Plus className="w-4 h-4" />
          </div>
        </div>

        {/* Step 2: Reserves */}
        <div className="relative p-5 rounded-xl bg-slate-800/30 border border-slate-700/50 text-center group hover:border-emerald-500/30 transition-colors">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-2">Source 2</div>
          <div className="text-lg font-bold text-white mb-1">Market Reserves</div>
          <div className="text-xs text-slate-500 leading-relaxed">
            Trading spreads create <span className="text-emerald-400 font-medium">Boost Liquidity</span><br/>(1x Multiplier)
          </div>
          <div className="absolute top-1/2 -right-6 hidden md:flex items-center justify-center w-8 h-8 rounded-full bg-slate-900 border border-slate-800 text-slate-500 z-10">
            <Equal className="w-4 h-4" />
          </div>
        </div>

        {/* Step 3: Result */}
        <div className="p-5 rounded-xl bg-gradient-to-br from-indigo-900/20 to-slate-900/50 border border-indigo-500/30 text-center shadow-lg shadow-indigo-900/10">
          <div className="text-[10px] text-indigo-300 uppercase tracking-wider mb-2">Total Depth</div>
          <div className="text-2xl font-bold text-white mb-1">Liquidity (b)</div>
          <div className="text-xs text-slate-400">
            Higher 'b' = Lower Slippage
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-800/50">
        <div className="flex gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 h-fit">
            <ArrowRight className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <strong className="text-white text-sm block mb-1">The Flywheel Effect</strong>
            <p className="text-xs text-slate-400 leading-relaxed">
              As markets earn spreads (Reserves), their liquidity (b) automatically grows. This attracts more trading volume, generating more spreads, further deepening liquidity.
            </p>
          </div>
        </div>
        
        <div className="flex gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10 h-fit">
            <Lock className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <strong className="text-white text-sm block mb-1">Solvency Requirement</strong>
            <p className="text-xs text-slate-400 leading-relaxed">
              To support this liquidity depth, the vault must lock capital. For a balanced market (50/50), this is <span className="font-mono text-amber-400">~0.693 × b</span>. As prices shift, this requirement changes dynamically.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-slate-800/50">
        <h4 className="font-heading font-semibold text-white mb-4 text-sm">Key Formulas</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-slate-800/20 border border-slate-700/30">
            <div className="font-mono text-xs text-blue-400 mb-1">b = Base + (Reserve × Multiplier)</div>
            <div className="text-[10px] text-slate-500">Liquidity depth calculation</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-800/20 border border-slate-700/30">
            <div className="font-mono text-xs text-slate-400 mb-1">Solvency Factor = Max Loss / b</div>
            <div className="text-[10px] text-slate-500">Typically ~0.693 for balanced markets</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-800/20 border border-slate-700/30">
            <div className="font-mono text-xs text-amber-400 mb-1">Max Loss ≈ b × 0.693</div>
            <div className="text-[10px] text-slate-500">For balanced markets (50/50)</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-800/20 border border-slate-700/30">
            <div className="font-mono text-xs text-blue-400 mb-1">Idle = TVL - Σ(Max Loss)</div>
            <div className="text-[10px] text-slate-500">Available capital for new markets</div>
          </div>
        </div>
      </div>
    </Card>
  );
};
