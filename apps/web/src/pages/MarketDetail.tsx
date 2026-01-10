import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Clock, Zap, BookOpen, Lock, Copy, CheckCircle, HelpCircle, BarChart3, AlertTriangle, Shield } from 'lucide-react';
import { useState } from 'react';
import { useLaunchpadMarket } from '../hooks/useLaunchpadMarket';
import { useLaunchpadMarkets } from '../hooks/useLaunchpadMarkets';
import { useAmmMarketByAddress } from '../hooks/useAmmMarketByAddress';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { OrderbookForm } from '../components/features/trader/OrderbookForm';
import { formatUnits } from 'viem';
import { useAccount, useReadContracts, useChainId } from 'wagmi';
import { getAddressExplorerUrl } from '../lib/chains';
import { MarketCard } from '../components/features/market/MarketCard';
import { LPLeaderboardCard } from '../components/features/market/LPLeaderboardCard';
import { LaunchpadLockedProceeds } from '../components/features/trader/LaunchpadLockedProceeds';
import { LAUNCHPAD_MARKET_ABI, LAUNCHPAD_OUTCOME_TOKEN_ABI, TRADER_VAULT_V4_ABI } from '../config/abis';
import { formatCurrency } from '../utils/format';
import { PositionActionsModal } from '../components/features/portfolio/PositionActionsModal';
import { useTraderVault } from '../hooks/useTraderVault';
import { GitMerge, Scissors, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import uiContent from '../config/ui-content.json';

// Compact Market Info Card Component with Help Button
const MarketInfoCard = ({
  priceYes,
  priceNo,
  totalAssets,
  totalNetAssets,
  totalSupply,
  totalCreatorDeposit,
  feesAccrued,
  ammReserve,
  bBase,
  qYes,
  qNo,
  totalSupplyYes,
  totalSupplyNo,
  totalLockedProceeds,
  lockedProceeds,
  address,
  creator,
  outcomeToken,
  ammCashProp,
  pureFloorProp,
  pureCeilingProp,
  isUnderwater,
  decimals,
  chainId,
}: {
  priceYes: number;
  priceNo: number;
  totalAssets?: bigint;
  totalNetAssets?: bigint;
  totalSupply?: bigint;
  totalCreatorDeposit?: bigint;
  feesAccrued?: bigint;
  ammReserve?: bigint;
  bBase?: bigint;
  qYes?: bigint;
  qNo?: bigint;
  totalSupplyYes?: bigint;
  totalSupplyNo?: bigint;
  totalLockedProceeds?: bigint;
  lockedProceeds?: bigint;
  address: string;
  creator?: `0x${string}`;
  outcomeToken?: `0x${string}`;
  ammCashProp?: bigint;
  pureFloorProp?: bigint;
  pureCeilingProp?: bigint;
  isUnderwater?: boolean;
  decimals?: number;
  chainId: number;
}) => {
  const [showHelp, setShowHelp] = useState(false);
  const t = uiContent.lp;
  
  // USDC amounts are in asset decimals, but feesAccrued and LP tokens are in 18 decimals (WAD)
  const ASSET_DECIMALS = decimals || 18;
  const WAD_DECIMALS = 18;
  
  const creatorDeposit = totalCreatorDeposit ? parseFloat(formatUnits(totalCreatorDeposit, ASSET_DECIMALS)) : 0;
  const fees = feesAccrued ? parseFloat(formatUnits(feesAccrued, WAD_DECIMALS)) : 0;
  const lockedTotal = totalLockedProceeds ? parseFloat(formatUnits(totalLockedProceeds, ASSET_DECIMALS)) : 0;

  // Use Isolated Ledger values from Hook (V6.2.4: Pure WAD)
  const tvl = pureFloorProp ? parseFloat(formatUnits(pureFloorProp, ASSET_DECIMALS)) : 0;
  const lpCeiling = pureCeilingProp ? parseFloat(formatUnits(pureCeilingProp, ASSET_DECIMALS)) : 0;
  const ammCash = ammCashProp ? parseFloat(formatUnits(ammCashProp, ASSET_DECIMALS)) : 0;

  const b = bBase ? parseFloat(formatUnits(bBase, WAD_DECIMALS)) : 1000;
  const qY = qYes ? parseFloat(formatUnits(qYes, WAD_DECIMALS)) : 0;
  const qN = qNo ? parseFloat(formatUnits(qNo, WAD_DECIMALS)) : 0;
  
  const lpSupply = totalSupply ? parseFloat(formatUnits(totalSupply, WAD_DECIMALS)) : 0;
  const floorExRate = lpSupply > 0 ? tvl / lpSupply : 1; 
  const ceilingExRate = lpSupply > 0 ? lpCeiling / lpSupply : 1;
  
  // V6 Stats Alignment
  const ammLiability = Math.max(qY, qN);
  const maxLoss = b * Math.log(2); 
  
  // Upside Potential (Simulation)
  const lpPayoutYes = Math.max(0, ammCash - qY);
  const lpPayoutNo = Math.max(0, ammCash - qN);
  const expectedPayout = priceYes * lpPayoutYes + priceNo * lpPayoutNo;
  
  const ammDelta = tvl - creatorDeposit - fees;

  return (
    <Card className="p-4">
      {/* Header with Help Button */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-white flex items-center gap-2 text-sm">
          <BarChart3 className="w-4 h-4 text-cyan-400" />
          Market Stats
        </h3>
        <button
          onClick={() => setShowHelp(!showHelp)}
          className={`p-1 rounded transition-colors ${showHelp ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-500 hover:text-cyan-400'}`}
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>

      {/* Education Panel (toggleable) */}
      {showHelp && (
        <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20 mb-3 text-[10px] text-slate-300 space-y-2">
          <p>• 🏦 <strong>Cash Basis</strong>: Reconciles all physical USDC inflows (Seed + Fees) and trade performance (Swap P&L) into the current AMM Gross Cash.</p>
          <p>• ⚖️ <strong>Equity Floor</strong>: The guaranteed minimum value of the pool (Net), assuming the worst-case outcome occurs for the House.</p>
          <p>• ↗ <strong>Valuation (ExRate)</strong>: The real-time price of 1 LP token, calculated by dividing total Net Equity by the token supply.</p>
          <p>• 📦 <strong>TVL Formula</strong>: Reconciles AMM cash with users' locked proceeds (24h cooling) to show the total contract-level USDC holdings.</p>
          <p>• ⚓ <strong>Liquidity Anchor</strong>: The fundamental LMSR relationship where LP supply is mathematically anchored to the depth parameter (b).</p>
        </div>
      )}

      {/* Underwater Warning */}
      {isUnderwater && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 mb-3 text-xs text-rose-400 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Pool is Underwater</p>
            <p className="opacity-80">AMM liabilities currently exceed available cash. LP Floor is guaranteed at $0.00 until trade volume or fee growth restores parity.</p>
          </div>
        </div>
      )}

      {/* Formula-Style Accounting (Pure LP Ledger) */}
      <div className="p-4 rounded-lg bg-slate-800/30 border border-slate-800/50 mb-3">
        <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-4 font-bold flex justify-between items-center">
          <span>AMM Isolated Ledger</span>
          <Badge className="text-[7px] bg-cyan-500/10 text-cyan-400 border-cyan-500/30 uppercase">Pure AMM Accounting</Badge>
      </div>

        {/* The Formula Grid */}
        <div className="space-y-4">
          {/* 1. Cash Basis (Primary Input) */}
          <div className="p-2.5 rounded border border-slate-700/30 bg-slate-900/40 group hover:border-slate-600/50 transition-colors">
            <div className="text-[8px] text-slate-500 uppercase font-black tracking-widest mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1">🏦 Cash Basis Formula</span>
              <span className="text-slate-500 font-mono italic">Seed + Fees + P&L = Gross</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap font-mono text-[11px]">
              <span className="text-slate-400" title="Initial Seed">({formatCurrency(creatorDeposit)})</span>
              <span className="text-slate-600">+</span>
              <span className="text-emerald-500/70" title="Trading Fees">({formatCurrency(fees)})</span>
              <span className="text-slate-600">+</span>
              <span className="text-cyan-500/70" title="Swap P&L">({formatCurrency(ammDelta)})</span>
              <span className="text-slate-600">=</span>
              <span className="text-white font-bold ml-auto text-sm">{formatCurrency(ammCash)}</span>
            </div>
          </div>

          {/* 2. Equity Floor (Net Value) */}
          <div className="p-2.5 rounded border border-cyan-500/20 bg-cyan-500/5 group hover:border-cyan-500/40 transition-colors">
            <div className="text-[8px] text-cyan-400/70 uppercase font-black tracking-widest mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1">⚖️ Equity Floor Formula</span>
              <span className="text-cyan-600/60 font-mono italic">Gross - Liability = Floor</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap font-mono text-[11px]">
              <span className="text-slate-300">({formatCurrency(ammCash)})</span>
              <span className="text-slate-600">-</span>
              <span className="text-rose-500/70" title="Max Liability">({formatCurrency(ammLiability)})</span>
              <span className="text-slate-600">=</span>
              <span className="text-cyan-400 font-bold ml-auto text-sm">{formatCurrency(tvl)}</span>
            </div>
          </div>

          {/* 3. Valuation (Unit Price) */}
          <div className="p-2.5 rounded border border-cyan-500/20 bg-cyan-500/5 group hover:border-cyan-500/40 transition-colors">
            <div className="text-[8px] text-cyan-400/70 uppercase font-black tracking-widest mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1">↗ Valuation (ExRate)</span>
              <span className="text-cyan-600/60 font-mono italic">Equity / Supply = Rate</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap font-mono text-[11px]">
              <span className="text-cyan-400/70">({formatCurrency(tvl)})</span>
              <span className="text-slate-600">/</span>
              <span className="text-slate-400" title="LP Supply">({lpSupply.toLocaleString(undefined, { maximumFractionDigits: 1 })})</span>
              <span className="text-slate-600">=</span>
              <span className="text-cyan-400 font-bold ml-auto text-sm">{floorExRate.toFixed(3)}x</span>
            </div>
          </div>

          {/* 4. TVL Reconciliation (Physical) */}
          <div className="p-2.5 rounded border border-slate-500/20 bg-slate-500/5 group hover:border-slate-500/40 transition-colors">
            <div className="text-[8px] text-slate-400/70 uppercase font-black tracking-widest mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1">📦 TVL Formula</span>
              <span className="text-slate-600/60 font-mono italic">Cash + Locked = TVL</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap font-mono text-[11px]">
              <span className="text-slate-400">({formatCurrency(ammCash)})</span>
              <span className="text-slate-600">+</span>
              <span className="text-slate-500/70" title="Locked Proceeds">({formatCurrency(lockedTotal)})</span>
              <span className="text-slate-600">=</span>
              <span className="text-white font-bold ml-auto text-sm">{formatCurrency(ammCash + lockedTotal)}</span>
            </div>
          </div>

          {/* 5. Liquidity Anchor (Mathematical) */}
          <div className="p-2.5 rounded border border-slate-700/30 bg-slate-900/40 group hover:border-slate-600/50 transition-colors">
            <div className="text-[8px] text-slate-500 uppercase font-black tracking-widest mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1">⚓ Liquidity Anchor Formula</span>
              <span className="text-slate-500 font-mono italic">b * ln(2) ≈ Supply</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap font-mono text-[11px]">
              <span className="text-slate-400" title="Liquidity Depth (b)">({b.toLocaleString(undefined, { maximumFractionDigits: 0 })})</span>
              <span className="text-slate-600">*</span>
              <span className="text-slate-500">0.693</span>
              <span className="text-slate-600">≈</span>
              <span className="text-slate-300 font-bold ml-auto text-sm">({lpSupply.toLocaleString(undefined, { maximumFractionDigits: 1 })})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics - Integrated Grid */}
      <div className="grid grid-cols-1 gap-2 mb-3">
        {/* ExRate Range */}
        <div className="p-3 rounded-lg bg-cyan-500/5 text-center border border-cyan-500/20 relative overflow-hidden group">
          <div className="absolute inset-0 bg-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative z-10">
            <div className="text-[9px] text-cyan-400 mb-1.5 font-black uppercase tracking-widest flex items-center justify-center gap-2">
              <Zap size={10} /> LP ExRate Range <Zap size={10} />
            </div>
            <div className="flex items-center justify-center gap-4">
              <div className="flex flex-col items-center">
                <span className="text-[8px] text-slate-500 uppercase font-bold">Floor</span>
                <span className="font-mono font-bold text-cyan-400 text-lg">{floorExRate.toFixed(3)}x</span>
              </div>
              <div className="h-8 w-px bg-cyan-500/20" />
              <div className="flex flex-col items-center">
                <span className="text-[8px] text-slate-500 uppercase font-bold">Ceiling</span>
                <span className="font-mono font-bold text-cyan-300 text-lg">{ceilingExRate.toFixed(3)}x</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Combo Inventory + Probability */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-1 opacity-10">
            <ArrowUpRight size={24} className="text-emerald-500" />
          </div>
          <div className="relative z-10">
            <div className="text-[9px] text-emerald-500/70 font-black uppercase tracking-widest mb-1">YES Outcome</div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-emerald-400">{(priceYes * 100).toFixed(1)}%</span>
              <span className="text-[10px] text-emerald-500/50 font-mono">
                {parseFloat(formatUnits(qYes || 0n, WAD_DECIMALS)).toLocaleString(undefined, { maximumFractionDigits: 0 })} shares
              </span>
        </div>
          </div>
        </div>
        <div className="p-3 rounded-lg bg-rose-500/5 border border-rose-500/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-1 opacity-10">
            <ArrowDownLeft size={24} className="text-rose-500" />
        </div>
          <div className="relative z-10 text-right">
            <div className="text-[9px] text-rose-500/70 font-black uppercase tracking-widest mb-1">NO Outcome</div>
            <div className="flex items-baseline gap-2 justify-end">
              <span className="text-[10px] text-rose-500/50 font-mono">
                {parseFloat(formatUnits(qNo || 0n, WAD_DECIMALS)).toLocaleString(undefined, { maximumFractionDigits: 0 })} shares
              </span>
              <span className="text-xl font-bold text-rose-400">{(priceNo * 100).toFixed(1)}%</span>
        </div>
      </div>
        </div>
        
        {/* Full-width Probability Bar */}
        <div className="col-span-2 h-1.5 rounded-full overflow-hidden flex bg-slate-800">
          <div className="bg-gradient-to-r from-emerald-600 to-emerald-400 transition-[width] duration-700 ease-out" style={{ width: `${priceYes * 100}%` }} />
          <div className="bg-gradient-to-r from-rose-400 to-rose-600 transition-[width] duration-700 ease-out" style={{ width: `${priceNo * 100}%` }} />
        </div>
      </div>

      {/* Settlement Simulation */}
      <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-800/50 mb-3">
        <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-3 font-bold">LP Payout Simulation</div>
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col">
            <span className="text-[8px] text-emerald-500/60 uppercase font-bold mb-1">If YES Wins</span>
            <span className="font-mono font-bold text-xs text-white">{formatCurrency(lpPayoutYes)}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[8px] text-rose-500/60 uppercase font-bold mb-1">If NO Wins</span>
            <span className="font-mono font-bold text-xs text-white">{formatCurrency(lpPayoutNo)}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[8px] text-cyan-500/60 uppercase font-bold mb-1 text-right">Expected</span>
            <span className="font-mono font-bold text-xs text-cyan-400">{formatCurrency(expectedPayout)}</span>
          </div>
        </div>
      </div>

      {/* Contract Addresses */}
      <div className="pt-2 border-t border-slate-800">
        <div className="text-[9px] text-slate-600 uppercase tracking-wider mb-2">Contracts</div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px]">
          <a href={getAddressExplorerUrl(chainId, address)} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-cyan-400 transition-colors">
            Market <span className="font-mono">{address.slice(0,6)}...{address.slice(-4)}</span>
          </a>
          {creator && (
            <a href={getAddressExplorerUrl(chainId, creator)} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-cyan-400 transition-colors">
              Creator <span className="font-mono">{creator.slice(0,6)}...{creator.slice(-4)}</span>
            </a>
          )}
          {outcomeToken && (
            <a href={getAddressExplorerUrl(chainId, outcomeToken)} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-cyan-400 transition-colors">
              Token <span className="font-mono">{outcomeToken.slice(0,6)}...{outcomeToken.slice(-4)}</span>
            </a>
          )}
        </div>
      </div>
    </Card>
  );
};

// Bonding Progress Card Component with Help Button
const BondingProgressCard = ({
  graduationProgress,
  bBase,
  graduationThreshold,
  graduate,
  isGraduatePending,
}: {
  graduationProgress: number;
  bBase?: bigint;
  graduationThreshold?: bigint;
  graduate: () => void;
  isGraduatePending: boolean;
}) => {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <Card className="p-5 border-cyan-500/30 bg-slate-900/60 relative overflow-hidden">
      {/* Static background glow */}
      <div 
        className="absolute inset-0 opacity-10 bg-cyan-500/20"
      />
      
      <div className="relative z-10">
        {/* Header with circular progress + help button */}
        <div className="flex items-center gap-4 mb-4">
          {/* Circular Progress Indicator */}
          <div className="relative w-14 h-14 flex-shrink-0">
            <svg className="w-14 h-14 transform -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="4" className="text-slate-800" />
              <circle
                cx="32" cy="32" r="28"
                fill="none"
                stroke="url(#bondingGradient)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${graduationProgress * 1.76} 176`}
                className="transition-[stroke-dasharray] duration-500 ease-out"
              />
              <defs>
                <linearGradient id="bondingGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#22d3ee" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold text-cyan-400 tabular-nums">
                {graduationProgress.toFixed(0)}%
              </span>
            </div>
          </div>
          
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white flex items-center gap-2 text-sm">
                <Zap className="w-4 h-4 text-cyan-400" />
                Bonding Phase
              </h3>
              <button
                onClick={() => setShowHelp(!showHelp)}
                className={`p-1 rounded transition-colors ${showHelp ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-500 hover:text-cyan-400'}`}
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            </div>
            <div className="text-sm text-slate-400">
              ${bBase ? (Number(bBase) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0'}
              <span className="text-slate-600 mx-1">/</span>
              ${graduationThreshold ? (Number(graduationThreshold) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0'}
            </div>
          </div>
        </div>

        {/* Education Panel (toggleable) */}
        {showHelp && (
          <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20 mb-3 text-xs text-slate-300 space-y-1">
            <p>• Trading fees grow the <strong>liquidity pool</strong></p>
            <p>• At <strong>100%</strong>, market graduates to full AMM</p>
            <p>• Early traders earn more <strong>LP tokens</strong></p>
            <p>• Pre-graduation fee: <strong>5%</strong> (vs 1% post-grad)</p>
          </div>
        )}

        {/* Linear progress bar */}
        <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden mb-2">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500 via-cyan-400 to-emerald-400 transition-[width] duration-500 ease-out rounded-full"
            style={{ 
              width: `${graduationProgress}%`,
            }}
          />
        </div>

        {graduationProgress >= 100 && (
          <Button
            onClick={graduate}
            disabled={isGraduatePending}
            className="w-full mt-3 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-black font-bold shadow-lg shadow-cyan-500/25"
          >
            {isGraduatePending ? 'Graduating...' : 'Graduate Market'}
          </Button>
        )}
      </div>
    </Card>
  );
};

// Helper component for address display with copy functionality
const AddressRow = ({ label, address, isCreator, chainId }: { label: string; address: string; isCreator?: boolean; chainId: number }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-slate-800/30 transition-colors group">
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">{label}</span>
        {isCreator && (
          <Badge className="text-[9px] bg-slate-500/20 text-slate-400 border-slate-500/50 py-0 px-1">
            Creator
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-2">
        <a
          href={getAddressExplorerUrl(chainId, address)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-mono text-slate-400 hover:text-cyan-400 transition-colors"
        >
          {address.slice(0, 6)}...{address.slice(-4)}
        </a>
        <button
          onClick={handleCopy}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-slate-700"
        >
          {copied ? (
            <CheckCircle className="w-3 h-3 text-emerald-400" />
          ) : (
            <Copy className="w-3 h-3 text-slate-500 hover:text-slate-300" />
          )}
        </button>
        <a
          href={getAddressExplorerUrl(chainId, address)}
          target="_blank"
          rel="noopener noreferrer"
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-slate-700"
        >
          <ExternalLink className="w-3 h-3 text-slate-500 hover:text-slate-300" />
        </a>
      </div>
    </div>
  );
};

export const MarketDetail = () => {
  const { address } = useParams<{ address: string }>();
  const { address: userAddress } = useAccount();
  const chainId = useChainId();
  const { refetch: refetchVault, availableBalance, decimals, vaultAddress: traderVaultAddress, isLoading: vaultLoading } = useTraderVault();
  const [modalMode, setModalMode] = useState<'merge' | 'split' | null>(null);
  
  // Fetch vault share balances for this market
  const { data: vaultShareData } = useReadContracts({
    contracts: [
      {
        address: traderVaultAddress,
        abi: TRADER_VAULT_V4_ABI,
        functionName: 'shareBalances',
        args: [userAddress || '0x0', address as `0x${string}`, 0], // YES
      },
      {
        address: traderVaultAddress,
        abi: TRADER_VAULT_V4_ABI,
        functionName: 'shareBalances',
        args: [userAddress || '0x0', address as `0x${string}`, 1], // NO
      },
    ],
    query: { enabled: !!userAddress && !!address && !!traderVaultAddress, refetchInterval: 5000 }
  });
  
  const vaultYesShares = vaultShareData?.[0]?.result ? parseFloat(formatUnits(vaultShareData[0].result as bigint, 18)) : 0;
  const vaultNoShares = vaultShareData?.[1]?.result ? parseFloat(formatUnits(vaultShareData[1].result as bigint, 18)) : 0;
  const usdcAvailable = parseFloat(formatUnits(availableBalance || 0n, decimals || 18));
  const mergeableAmount = Math.min(vaultYesShares, vaultNoShares);

  const marketData = useLaunchpadMarket(address as `0x${string}`);
  const {
    launchpad,
    isLoading: launchpadLoading,
    redeemLP,
    isPending: isRedeemLPPending,
  } = marketData;

  // TODO: Graduate function should be added to useLaunchpadMarket hook
  const graduate = async () => { console.warn('Graduate not implemented'); };
  const isGraduatePending = false;

  const isGraduated = launchpad?.isGraduated ?? false;
  const graduationThreshold = launchpad?.graduationThreshold ?? 0n;
  const bBase = launchpad?.initialBBase ?? 0n;
  const bEffective = launchpad?.currentBBase ?? 0n;
  const creator = launchpad?.creator;
  const feesAccrued = launchpad?.feesAccrued ?? 0n;
  const totalCreatorDeposit = launchpad?.creatorDeposit ?? 0n;
  const userLpBalance = launchpad?.userLpBalance ?? 0n;
  const creatorLpBalance = launchpad?.userLpBalance ?? 0n;
  const floorValue = launchpad?.floorValue ?? 0n;

  // TODO: These properties should be fetched from TruthMarket/AMMEngine hooks
  const deadline = 0;
  const isLive = !isGraduated;
  const isSettled = false;
  const outcomeToken = undefined as `0x${string}` | undefined;
  const adjudicator = undefined as `0x${string}` | undefined;
  const tStar = 0n;
  const winningOutcome = 0;
  const marketDecimals = decimals || 6;
  const totalSupply = launchpad?.lpSupply ?? 0n;
  const totalAssets = 0n;
  const totalNetAssets = 0n;
  const ammReserve = 0n;
  const qYes = 0n;
  const qNo = 0n;
  const totalSupplyYes = 0n;
  const totalSupplyNo = 0n;
  const userLpNetValue = 0n;
  const userLpCeilingValue = 0n;
  const ammCash = 0n;
  const pureFloor = floorValue;
  const pureCeiling = 0n;
  const isUnderwater = false;
  const userSharePercent = 0;
  const totalLockedProceeds = 0n;
  const lockedProceeds = 0n;
  const userYesShares = 0n;
  const userNoShares = 0n;
  const userYesWallet = 0n;
  const userNoWallet = 0n;
  const priceYes = 0.5;
  const priceNo = 0.5;

  const { markets: allMarkets, isLoading: marketsLoading } = useLaunchpadMarkets();
  const marketMeta = allMarkets?.find(m => m.address.toLowerCase() === address?.toLowerCase());

  // Fallback: Fetch name/symbol directly from outcome token if not in markets list
  const { data: directTokenData } = useReadContracts({
    contracts: outcomeToken ? [
      { address: outcomeToken, abi: LAUNCHPAD_OUTCOME_TOKEN_ABI, functionName: 'name' },
      { address: outcomeToken, abi: LAUNCHPAD_OUTCOME_TOKEN_ABI, functionName: 'symbol' },
    ] : [],
    query: {
      enabled: !!outcomeToken && !marketMeta && !marketsLoading,
    },
  });

  const directName = directTokenData?.[0]?.result as string | undefined;
  const directSymbol = directTokenData?.[1]?.result as string | undefined;

  // Use marketMeta if available, otherwise use direct fetch, otherwise fallback
  const displayName = marketMeta?.name || directName || 'Loading...';
  const displaySymbol = marketMeta?.symbol || directSymbol || '???';

  if (!address) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-400">Market not found</p>
        <Link to="/markets" className="text-cyan-400 hover:text-cyan-300 mt-4 inline-block">
          ← Back to Markets
        </Link>
      </div>
    );
  }

  const isExpired = deadline && Date.now() / 1000 > deadline && !isGraduated;
  
  // V6.2.5: Optimized frontend prices from Launchpad hook
  const pYes = priceYes ?? 0.5;
  const pNo = priceNo ?? (1 - pYes);

  const graduationProgress = bBase && graduationThreshold
    ? Math.min(100, Number((bBase * 100n) / graduationThreshold))
    : 0;

  // Mock market object for components that expect one
  const market = {
    priceYes: pYes,
    priceNo: pNo,
    qYes: qYes || 0n,
    qNo: qNo || 0n,
    bParam: bEffective || bBase || 0n,
    status: isSettled ? 'settled' : (isLive === false ? 'cooldown' : 'trading'),
    userYesShares: parseFloat(formatUnits(userYesShares || 0n, 18)),
    userNoShares: parseFloat(formatUnits(userNoShares || 0n, 18)),
    userYesWallet: parseFloat(formatUnits(userYesWallet || 0n, 18)),
    userNoWallet: parseFloat(formatUnits(userNoWallet || 0n, 18)),
  };

  // LMSR parameters for display
  const bParamNum = market?.bParam ? parseFloat(formatUnits(BigInt(market.bParam.toString()), 18)) : 1000;

  // Calculate new prices after trade (for preview) - Simplified for now, just show current
  // In future we can bubble up state from TradingPanel if needed for the graphic
  const tradeQuotePreview = null;

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/markets"
          className="p-2 rounded-lg border border-slate-700 hover:border-cyan-500/50 hover:bg-slate-800/50 transition-all"
        >
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-white">
              {displayName}
            </h1>
            {isSettled ? (
              <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/50">
                ⚖️ Settled
              </Badge>
            ) : isGraduated ? (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/50">
                ✓ Graduated
              </Badge>
            ) : isExpired ? (
              <Badge className="bg-red-500/20 text-red-400 border-red-500/50">
                Expired
              </Badge>
            ) : (
              <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/50">
                ⚡ Bonding
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <a
              href={getAddressExplorerUrl(chainId, address || '')}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-cyan-400 transition-colors font-mono"
            >
              {address?.slice(0, 6)}...{address?.slice(-4)}
              <ExternalLink className="w-3 h-3" />
            </a>
            {deadline && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(Number(deadline) * 1000).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Market Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Bonding Progress Card */}
          {!isGraduated && (
            <BondingProgressCard
              graduationProgress={graduationProgress}
              bBase={bBase}
              graduationThreshold={graduationThreshold}
              graduate={graduate}
              isGraduatePending={isGraduatePending}
            />
          )}

          {/* Combined Market Info Card - Redesigned */}
          <MarketInfoCard
            priceYes={pYes}
            priceNo={pNo}
            totalAssets={totalAssets}
            totalNetAssets={totalNetAssets}
            totalSupply={totalSupply}
            totalCreatorDeposit={totalCreatorDeposit}
            feesAccrued={feesAccrued}
            ammReserve={ammReserve}
            bBase={bBase}
            qYes={qYes}
            qNo={qNo}
            totalSupplyYes={totalSupplyYes}
            totalSupplyNo={totalSupplyNo}
            totalLockedProceeds={totalLockedProceeds}
            lockedProceeds={lockedProceeds}
            address={address}
            creator={creator}
            outcomeToken={outcomeToken}
            ammCashProp={ammCash}
            pureFloorProp={pureFloor}
            pureCeilingProp={pureCeiling}
            isUnderwater={isUnderwater}
            decimals={marketDecimals || decimals}
            chainId={chainId}
          />

          {/* Settlement Status Card */}
          {adjudicator && (
            <Card className="p-6 border-slate-500/20 bg-slate-500/5">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-slate-500/20 text-slate-400">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white">
                    {isSettled ? 'Market Settlement' : 'Adjudication'}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Adjudicator: {adjudicator?.slice(0, 8)}...{adjudicator?.slice(-6)}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {isSettled ? (
                  <>
                    <div className="flex justify-between items-center p-3 rounded-lg bg-slate-900/50 border border-slate-800">
                      <span className="text-sm text-slate-400">Winning Outcome</span>
                      <Badge className={winningOutcome === 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"}>
                        {winningOutcome === 0 ? 'YES' : 'NO'}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-lg bg-slate-900/50 border border-slate-800">
                      <span className="text-sm text-slate-400">Truth Time (T*)</span>
                      <span className="text-sm font-mono text-white">
                        {tStar ? new Date(tStar * 1000).toLocaleString() : 'N/A'}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800 text-center">
                    <p className="text-xs text-slate-500 italic">
                      {isExpired 
                        ? 'Awaiting adjudication from protocol...' 
                        : `This market will be settled by the adjudicator after ${deadline ? new Date(deadline * 1000).toLocaleDateString() : 'expiry'}.`}
                    </p>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Inventory Management (Post-Graduation Only) */}
          {isGraduated && address && (
            <Card className="p-4 border-cyan-500/20 bg-cyan-950/10">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[10px] text-cyan-400 font-black uppercase tracking-widest flex items-center gap-2">
                  <GitMerge size={12} /> Inventory Management
                </div>
                <div className="text-[9px] text-slate-500 font-medium">
                  Direct mint/burn sets for this market
                </div>
              </div>
              
              {/* Balance Display */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="p-2 rounded-lg bg-slate-900/50 border border-slate-800/50">
                  <div className="text-[8px] text-slate-500 uppercase tracking-wider font-bold mb-0.5">USDC</div>
                  <div className="text-xs font-mono font-bold text-white">{formatCurrency(usdcAvailable)}</div>
                </div>
                <div className="p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                  <div className="text-[8px] text-emerald-400/60 uppercase tracking-wider font-bold mb-0.5">YES</div>
                  <div className="text-xs font-mono font-bold text-emerald-400">{Math.floor(vaultYesShares).toLocaleString()}</div>
                </div>
                <div className="p-2 rounded-lg bg-rose-500/5 border border-rose-500/10">
                  <div className="text-[8px] text-rose-400/60 uppercase tracking-wider font-bold mb-0.5">NO</div>
                  <div className="text-xs font-mono font-bold text-rose-400">{Math.floor(vaultNoShares).toLocaleString()}</div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setModalMode('merge')}
                  disabled={mergeableAmount <= 0}
                  className="group py-2 text-[10px] font-black uppercase tracking-widest border-slate-700 hover:border-slate-600 bg-slate-800/80 hover:bg-slate-700 disabled:opacity-50"
                >
                  <GitMerge size={12} className="mr-1 opacity-70 group-hover:scale-110 transition-transform" /> Merge {mergeableAmount > 0 ? `(${mergeableAmount.toFixed(0)})` : ''}
                </Button>

                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => setModalMode('split')}
                  disabled={usdcAvailable <= 0}
                  className="group py-2 text-[10px] font-black uppercase tracking-widest bg-cyan-600 hover:bg-cyan-500 border-none text-white disabled:opacity-50"
                >
                  <Scissors size={12} className="mr-1 opacity-70 group-hover:scale-110 transition-transform" /> Split
                </Button>
              </div>
            </Card>
          )}

          {/* Orderbook Trading (Post-Graduation Only) */}
          {isGraduated && address && (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-cyan-400" />
                  Orderbook Trading
                </h3>
                <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/50">
                  Limit Orders
                </Badge>
              </div>
              <OrderbookForm marketId={address} />
            </Card>
          )}

        </div>

        {/* Right: LP Position + Trading Panel */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 space-y-4 will-change-transform">
            {/* LP Leaderboard Card */}
            <LPLeaderboardCard
              marketAddress={address as `0x${string}`}
              userAddress={userAddress}
              userLpBalance={userLpBalance}
              userLpNetValue={userLpNetValue || 0n}
              userLpCeilingValue={userLpCeilingValue || 0n}
              userSharePercent={userSharePercent || 0}
              isLive={isLive}
              redeemLP={redeemLP}
              isRedeemLPPending={isRedeemLPPending}
              creatorAddress={creator}
              creatorLpBalance={creatorLpBalance}
              totalSupply={totalSupply}
              totalAssets={totalAssets}
              totalNetAssets={totalNetAssets}
              totalLockedProceeds={totalLockedProceeds}
              ammCashProp={ammCash}
              pureFloorProp={pureFloor}
              pureCeilingProp={pureCeiling}
              decimals={marketDecimals || decimals}
            />

            {/* Locked Proceeds Card */}
            <LaunchpadLockedProceeds marketAddress={address as `0x${string}`} />

            {/* Trading Panel */}
            <MarketCard
              address={address as `0x${string}`}
              name={displayName}
              symbol={displaySymbol}
              isGraduated={isGraduated}
              deadline={marketMeta?.deadline ? Number(marketMeta.deadline) : (deadline ? Number(deadline) : undefined)}
              disableNavigation={true}
              market={market}
              bBase={bBase}
              graduationThreshold={graduationThreshold}
            />
          </div>
        </div>
      </div>

      <PositionActionsModal
        isOpen={modalMode !== null}
        onClose={() => setModalMode(null)}
        marketId={address}
        mode={modalMode || 'merge'}
        refetch={() => {
          marketData.refetch();
          refetchVault();
        }}
      />
    </div>
  );
};

