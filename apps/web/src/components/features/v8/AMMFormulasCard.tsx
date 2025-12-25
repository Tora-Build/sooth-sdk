/**
 * AMMFormulasCard - The 5 core AMM accounting formulas from V7
 * 
 * Displays the key formulas that define the AMM's financial state:
 * 1. Cash Basis: Seed + Fees + P&L = Gross
 * 2. Equity Floor: Gross - Liability = Floor
 * 3. Valuation: Equity / Supply = ExRate
 * 4. TVL: Cash + Locked = TVL
 * 5. Liquidity Anchor: b × ln(2) ≈ Supply
 */
import { useState } from 'react';
import { BarChart3, HelpCircle, AlertTriangle } from 'lucide-react';
import { Card } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { useLaunchpadMarketDirect, useAmmMarketDirect } from '../../../hooks/v8';

interface AMMFormulasCardProps {
  address: `0x${string}`;
}

// Format currency
const formatCurrency = (value: number): string => {
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(1)}k`;
  }
  return `$${value.toFixed(2)}`;
};

// Format WAD to number
const formatWad = (value: bigint | undefined): number => {
  if (!value) return 0;
  return Number(value) / 1e18;
};

// ln(2) constant
const LN2 = 0.693147;

export const AMMFormulasCard = ({ address }: AMMFormulasCardProps) => {
  const [showHelp, setShowHelp] = useState(false);
  
  const { launchpad, isLoading: launchpadLoading } = useLaunchpadMarketDirect(address);
  const { amm, isLoading: ammLoading } = useAmmMarketDirect(address);

  const isLoading = launchpadLoading || ammLoading;

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-slate-700 rounded w-1/3" />
          <div className="h-20 bg-slate-800 rounded" />
          <div className="h-20 bg-slate-800 rounded" />
        </div>
      </Card>
    );
  }

  // Extract values from hooks (V8 uses WAD for all internal values)
  const creatorDeposit = formatWad(launchpad?.creatorDeposit);
  const feesAccrued = formatWad(launchpad?.feesAccrued);
  const currentBBase = formatWad(launchpad?.currentBBase);
  const lpSupply = formatWad(launchpad?.lpSupply);
  
  const qYes = formatWad(amm?.qYes);
  const qNo = formatWad(amm?.qNo);
  
  // Calculations
  const ammLiability = Math.max(qYes, qNo);
  const ammDelta = currentBBase - creatorDeposit; // Simplified P&L from b growth
  const ammCash = creatorDeposit + feesAccrued + ammDelta;
  const equityFloor = Math.max(0, ammCash - ammLiability);
  const floorExRate = lpSupply > 0 ? equityFloor / lpSupply : 1;
  const expectedLpFromAnchor = currentBBase * LN2;
  
  // Check if underwater
  const isUnderwater = ammCash < ammLiability;

  // Placeholder for locked proceeds (needs TraderVault integration)
  const lockedProceeds = 0;
  const tvl = ammCash + lockedProceeds;

  return (
    <Card className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-white flex items-center gap-2 text-sm">
          <BarChart3 className="w-4 h-4 text-cyan-400" />
          AMM Formulas
        </h3>
        <button
          onClick={() => setShowHelp(!showHelp)}
          className={`p-1 rounded transition-colors ${showHelp ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-500 hover:text-cyan-400'}`}
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>

      {/* Education Panel */}
      {showHelp && (
        <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20 mb-3 text-[10px] text-slate-300 space-y-2">
          <p>• 🏦 <strong>Cash Basis</strong>: Reconciles all USDC inflows (Seed + Fees) and trade performance (Swap P&L) into AMM Gross Cash.</p>
          <p>• ⚖️ <strong>Equity Floor</strong>: The guaranteed minimum value of the pool (Net), assuming worst-case outcome for the House.</p>
          <p>• 📈 <strong>Valuation (ExRate)</strong>: The real-time price of 1 LP token = Equity / Supply.</p>
          <p>• 📦 <strong>TVL Formula</strong>: Total contract-level USDC = AMM cash + users' locked proceeds (24h cooling).</p>
          <p>• ⚓ <strong>Liquidity Anchor</strong>: LMSR relationship where LP supply is mathematically anchored to depth parameter (b).</p>
        </div>
      )}

      {/* Underwater Warning */}
      {isUnderwater && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 mb-3 text-xs text-rose-400 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Pool is Underwater</p>
            <p className="opacity-80">AMM liabilities exceed available cash. LP Floor is $0.00 until trade volume restores parity.</p>
          </div>
        </div>
      )}

      {/* Formula Grid */}
      <div className="p-4 rounded-lg bg-slate-800/30 border border-slate-800/50">
        <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-4 font-bold flex justify-between items-center">
          <span>AMM Isolated Ledger</span>
          <Badge className="text-[7px] bg-cyan-500/10 text-cyan-400 border-cyan-500/30 uppercase">
            Pure AMM Accounting
          </Badge>
        </div>

        <div className="space-y-4">
          {/* 1. Cash Basis */}
          <div className="p-2.5 rounded border border-slate-700/30 bg-slate-900/40 group hover:border-slate-600/50 transition-colors">
            <div className="text-[8px] text-slate-500 uppercase font-black tracking-widest mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1">🏦 Cash Basis Formula</span>
              <span className="text-slate-500 font-mono italic">Seed + Fees + P&L = Gross</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap font-mono text-[11px]">
              <span className="text-slate-400" title="Initial Seed">({formatCurrency(creatorDeposit)})</span>
              <span className="text-slate-600">+</span>
              <span className="text-emerald-500/70" title="Trading Fees">({formatCurrency(feesAccrued)})</span>
              <span className="text-slate-600">+</span>
              <span className={`${ammDelta >= 0 ? 'text-cyan-500/70' : 'text-rose-500/70'}`} title="Swap P&L">
                ({formatCurrency(ammDelta)})
              </span>
              <span className="text-slate-600">=</span>
              <span className="text-white font-bold ml-auto text-sm">{formatCurrency(ammCash)}</span>
            </div>
          </div>

          {/* 2. Equity Floor */}
          <div className="p-2.5 rounded border border-cyan-500/20 bg-cyan-500/5 group hover:border-cyan-500/40 transition-colors">
            <div className="text-[8px] text-cyan-400/70 uppercase font-black tracking-widest mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1">⚖️ Equity Floor Formula</span>
              <span className="text-cyan-600/60 font-mono italic">Gross - Liability = Floor</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap font-mono text-[11px]">
              <span className="text-slate-300">({formatCurrency(ammCash)})</span>
              <span className="text-slate-600">-</span>
              <span className="text-rose-500/70" title="Max Liability = max(qYes, qNo)">({formatCurrency(ammLiability)})</span>
              <span className="text-slate-600">=</span>
              <span className="text-cyan-400 font-bold ml-auto text-sm">{formatCurrency(equityFloor)}</span>
            </div>
          </div>

          {/* 3. Valuation */}
          <div className="p-2.5 rounded border border-purple-500/20 bg-purple-500/5 group hover:border-purple-500/40 transition-colors">
            <div className="text-[8px] text-purple-400/70 uppercase font-black tracking-widest mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1">📈 Valuation (ExRate)</span>
              <span className="text-purple-600/60 font-mono italic">Equity / Supply = Rate</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap font-mono text-[11px]">
              <span className="text-cyan-400/70">({formatCurrency(equityFloor)})</span>
              <span className="text-slate-600">/</span>
              <span className="text-slate-400" title="LP Supply">
                ({lpSupply.toLocaleString(undefined, { maximumFractionDigits: 1 })})
              </span>
              <span className="text-slate-600">=</span>
              <span className="text-purple-400 font-bold ml-auto text-sm">{floorExRate.toFixed(3)}x</span>
            </div>
          </div>

          {/* 4. TVL */}
          <div className="p-2.5 rounded border border-amber-500/20 bg-amber-500/5 group hover:border-amber-500/40 transition-colors">
            <div className="text-[8px] text-amber-400/70 uppercase font-black tracking-widest mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1">📦 TVL Formula</span>
              <span className="text-amber-600/60 font-mono italic">Cash + Locked = TVL</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap font-mono text-[11px]">
              <span className="text-slate-400">({formatCurrency(ammCash)})</span>
              <span className="text-slate-600">+</span>
              <span className="text-amber-500/70" title="Locked Proceeds (24h)">({formatCurrency(lockedProceeds)})</span>
              <span className="text-slate-600">=</span>
              <span className="text-white font-bold ml-auto text-sm">{formatCurrency(tvl)}</span>
            </div>
          </div>

          {/* 5. Liquidity Anchor */}
          <div className="p-2.5 rounded border border-slate-700/30 bg-slate-900/40 group hover:border-slate-600/50 transition-colors">
            <div className="text-[8px] text-slate-500 uppercase font-black tracking-widest mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1">⚓ Liquidity Anchor Formula</span>
              <span className="text-slate-500 font-mono italic">b × ln(2) ≈ Supply</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap font-mono text-[11px]">
              <span className="text-slate-400" title="Liquidity Depth (b)">
                ({currentBBase.toLocaleString(undefined, { maximumFractionDigits: 0 })})
              </span>
              <span className="text-slate-600">×</span>
              <span className="text-slate-500">0.693</span>
              <span className="text-slate-600">≈</span>
              <span className="text-slate-300 font-bold ml-auto text-sm">
                ({expectedLpFromAnchor.toLocaleString(undefined, { maximumFractionDigits: 1 })})
              </span>
            </div>
            <div className="text-[9px] text-slate-600 mt-1 text-right">
              Actual LP Supply: {lpSupply.toLocaleString(undefined, { maximumFractionDigits: 1 })}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

