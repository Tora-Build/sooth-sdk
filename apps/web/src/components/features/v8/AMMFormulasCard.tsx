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
import React, { useState } from 'react';
import { BarChart3, HelpCircle, AlertTriangle } from 'lucide-react';
import { Card } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { useLaunchpadMarketDirect, useAmmMarketDirect } from '../../../hooks/v8';
import { useMarketStatsMath } from '../../../hooks/v8/useMarketStatsMath';
import { formatUnits } from 'viem';
import { useReadContract } from 'wagmi';
import { useDeployments } from '../../../hooks/useDeployments';
import { V8_ABIS } from '../../../config/abis';

interface AMMFormulasCardProps {
  address: `0x${string}`;
}

export const AMMFormulasCard = ({ address }: AMMFormulasCardProps) => {
  const [showHelp, setShowHelp] = useState(false);
  const deployments = useDeployments();
  
  const { launchpad, isLoading: launchpadLoading } = useLaunchpadMarketDirect(address);
  const { amm, isLoading: ammLoading } = useAmmMarketDirect(address);

  // Get USDC Decimals
  const { data: usdcDecimals } = useReadContract({
    address: deployments?.contracts?.MockUSDC as `0x${string}`,
    abi: V8_ABIS.OutcomeToken,
    functionName: 'decimals',
    query: { enabled: !!deployments?.contracts?.MockUSDC, staleTime: Infinity, refetchInterval: false },
  });
  const decimals = Number(usdcDecimals ?? 18);

  const stats = useMarketStatsMath(launchpad as any, amm as any, decimals);

  const isLoading = launchpadLoading || ammLoading;

  if (isLoading || !stats) {
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

  // Format currency helpers
  const fmtUsd = (val: bigint) => {
    const num = Number(formatUnits(val, decimals));
    if (num > 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(2)}B`;
    if (num > 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
    return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  };
  const fmtVal = (val: bigint) => {
    const num = Math.abs(Number(formatUnits(val, decimals)));
    if (num > 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(2)}B`;
    if (num > 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
    return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  };
  const fmtNum = (val: bigint | number) => Number(typeof val === 'bigint' ? formatUnits(val, 18) : val).toLocaleString(undefined, { maximumFractionDigits: 1 });

  // P&L Sign
  const pnlSign = stats.pnl >= 0n ? '+' : '-';
  const pnlColor = stats.pnl >= 0n ? 'text-emerald-400' : 'text-rose-400';
  
  // Check if underwater
  const isUnderwater = stats.floor === 0n && stats.gross < stats.liability;

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
              <span className="text-slate-400" title="Initial Seed">({fmtUsd(stats.seed)})</span>
              <span className="text-slate-600">+</span>
              <span className="text-emerald-500/70" title="Trading Fees">({fmtUsd(stats.fees)})</span>
              <span className="text-slate-600">+</span>
              <span className={pnlColor} title="Swap P&L (LMSR Cost)">
                ({pnlSign}{fmtVal(stats.pnl)})
              </span>
              <span className="text-slate-600">=</span>
              <span className="text-white font-bold ml-auto text-sm">{fmtUsd(stats.gross)}</span>
            </div>
          </div>

          {/* 2. Equity Floor */}
          <div className="p-2.5 rounded border border-cyan-500/20 bg-cyan-500/5 group hover:border-cyan-500/40 transition-colors">
            <div className="text-[8px] text-cyan-400/70 uppercase font-black tracking-widest mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1">⚖️ Equity Floor Formula</span>
              <span className="text-cyan-600/60 font-mono italic">Gross - Liability = Floor</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap font-mono text-[11px]">
              <span className="text-slate-300">({fmtUsd(stats.gross)})</span>
              <span className="text-slate-600">-</span>
              <span className="text-rose-500/70" title="Max Liability = max(qYes, qNo)">({fmtUsd(stats.liability)})</span>
              <span className="text-slate-600">=</span>
              <span className="text-cyan-400 font-bold ml-auto text-sm">{fmtUsd(stats.floor)}</span>
            </div>
          </div>

          {/* 3. Valuation */}
          <div className="p-2.5 rounded border border-purple-500/20 bg-purple-500/5 group hover:border-purple-500/40 transition-colors">
            <div className="text-[8px] text-purple-400/70 uppercase font-black tracking-widest mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1">📈 Valuation (ExRate)</span>
              <span className="text-purple-600/60 font-mono italic">Equity / Supply = Rate</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap font-mono text-[11px]">
              <span className="text-cyan-400/70">({fmtUsd(stats.floor)})</span>
              <span className="text-slate-600">/</span>
              <span className="text-slate-400" title="LP Supply">
                ({fmtNum(stats.supply)})
              </span>
              <span className="text-slate-600">=</span>
              <span className="text-purple-400 font-bold ml-auto text-sm">{stats.floorRate.toFixed(3)}x</span>
            </div>
          </div>

          {/* 4. TVL */}
          <div className="p-2.5 rounded border border-amber-500/20 bg-amber-500/5 group hover:border-amber-500/40 transition-colors">
            <div className="text-[8px] text-amber-400/70 uppercase font-black tracking-widest mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1">📦 TVL Formula</span>
              <span className="text-amber-600/60 font-mono italic">Cash + Locked = TVL</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap font-mono text-[11px]">
              <span className="text-slate-400">({fmtUsd(stats.gross)})</span>
              <span className="text-slate-600">+</span>
              <span className="text-amber-500/70" title="Locked Proceeds (24h)">($0.00)</span>
              <span className="text-slate-600">=</span>
              <span className="text-white font-bold ml-auto text-sm">{fmtUsd(stats.gross)}</span>
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
                ({fmtNum(stats.b)})
              </span>
              <span className="text-slate-600">×</span>
              <span className="text-slate-500">0.693</span>
              <span className="text-slate-600">≈</span>
              <span className="text-slate-300 font-bold ml-auto text-sm">
                ({fmtNum(stats.anchorSupply)})
              </span>
            </div>
            <div className="text-[9px] text-slate-600 mt-1 text-right">
              Actual LP Supply: {fmtNum(stats.supply)}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

