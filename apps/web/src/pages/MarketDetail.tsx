import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Clock, Zap, BookOpen, Lock, Copy, CheckCircle, HelpCircle, BarChart3 } from 'lucide-react';
import { useState } from 'react';
import { useLaunchpadMarket } from '../hooks/v5/useLaunchpadMarket';
import { useLaunchpadMarkets } from '../hooks/v5/useLaunchpadMarkets';
import { useAmmMarketByAddress } from '../hooks/useAmmMarketByAddress';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { OrderbookForm } from '../components/features/trader/OrderbookForm';
import { formatUnits } from 'viem';
import { useAccount, useReadContracts } from 'wagmi';
import { MarketCard } from '../components/features/market/MarketCard';
import { LPLeaderboardCard } from '../components/features/market/LPLeaderboardCard';
import { LAUNCHPAD_MARKET_ABI, LAUNCHPAD_OUTCOME_TOKEN_ABI } from '../config/abis';
import { formatCurrency } from '../utils/format';

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
  bParamNum,
  qYes,
  qNo,
  totalLockedProceeds,
  lockedProceeds,
  address,
  creator,
  outcomeToken,
}: {
  priceYes: number;
  priceNo: number;
  totalAssets?: bigint;
  totalNetAssets?: bigint;
  totalSupply?: bigint;
  totalCreatorDeposit?: bigint;
  feesAccrued?: bigint;
  ammReserve?: bigint;
  bParamNum: number;
  qYes: number;
  qNo: number;
  totalLockedProceeds?: bigint;
  lockedProceeds?: bigint;
  address: string;
  creator?: `0x${string}`;
  outcomeToken?: `0x${string}`;
}) => {
  const [showHelp, setShowHelp] = useState(false);
  
  // USDC amounts are in 6 decimals, but feesAccrued and LP tokens are in 18 decimals (WAD)
  const ASSET_DECIMALS = 6;
  const WAD_DECIMALS = 18;
  const grossAssets = totalAssets ? parseFloat(formatUnits(totalAssets, ASSET_DECIMALS)) : 0;
  const tvl = totalNetAssets ? parseFloat(formatUnits(totalNetAssets, ASSET_DECIMALS)) : 0;
  const creatorDeposit = totalCreatorDeposit ? parseFloat(formatUnits(totalCreatorDeposit, ASSET_DECIMALS)) : 0;
  const fees = feesAccrued ? parseFloat(formatUnits(feesAccrued, WAD_DECIMALS)) : 0;
  
  // V6.1.4: Risk-Adjusted AMM Delta
  // Represents net liquid profit/loss if market settled at worst outcome right now.
  const ammDelta = tvl - creatorDeposit - fees;
  
  const lpSupply = totalSupply ? parseFloat(formatUnits(totalSupply, WAD_DECIMALS)) : 0;
  const exchangeRate = lpSupply > 0 ? tvl / lpSupply : 1; // Multiplier (e.g. 1.2x)
  
  const qYesNum = qYes;
  const qNoNum = qNo;
  const maxLiability = Math.max(qYesNum, qNoNum);
  const maxLoss = bParamNum * 0.693; // b × ln(2)
  
  // Upside Potential: Assets - Locked - Fees - Creator (The pure "unrealized" AMM trade cashflow)
  const totalLocked = totalLockedProceeds ? parseFloat(formatUnits(totalLockedProceeds, ASSET_DECIMALS)) : 0;
  const cashTVL = grossAssets - totalLocked;
  const lpPayoutYes = Math.max(0, cashTVL - qYesNum);
  const lpPayoutNo = Math.max(0, cashTVL - qNoNum);
  const expectedPayout = priceYes * lpPayoutYes + priceNo * lpPayoutNo;
  
  const unrealizedPnL = grossAssets - totalLocked - creatorDeposit - fees;

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
        <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20 mb-3 text-xs text-slate-300 space-y-1">
          <p>• <strong>Floor Equity</strong>: The net USDC value owned by LPs after accounting for all debt and potential winner payouts.</p>
          <p>• <strong>AMM Floor Delta</strong>: The net profit/loss realized by the pool from AMM inventory pricing shifts.</p>
          <p>• <strong>LP ExRate</strong>: Guaranteed growth multiplier. This value can never crash at settlement because liabilities are already priced in.</p>
          <p>• <strong>Market Liability</strong>: The maximum possible USDC payout if the majority outcome wins right now.</p>
        </div>
      )}

      {/* Probability Display */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-emerald-400 tabular-nums">{(priceYes * 100).toFixed(1)}%</span>
          <span className="text-slate-600">/</span>
          <span className="text-2xl font-bold text-rose-400 tabular-nums">{(priceNo * 100).toFixed(1)}%</span>
        </div>
        <span className="text-[10px] text-slate-500">YES / NO</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden flex mb-3">
        <div className="bg-gradient-to-r from-emerald-500 to-emerald-400 transition-[width] duration-700 ease-out" style={{ width: `${priceYes * 100}%` }} />
        <div className="bg-gradient-to-r from-rose-400 to-rose-500 transition-[width] duration-700 ease-out" style={{ width: `${priceNo * 100}%` }} />
      </div>

      {/* TVL Breakdown */}
      <div className="p-3 rounded-lg bg-slate-800/30 mb-3">
        <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-2 font-semibold">Vault Breakdown</div>
        <div className="space-y-2 text-xs">
          <div className="grid grid-cols-[1fr_auto] items-baseline gap-4">
            <span className="text-slate-400">Creator Preseed</span>
            <span className="font-mono text-slate-300">{formatCurrency(creatorDeposit)}</span>
          </div>
          <div className="grid grid-cols-[1fr_auto] items-baseline gap-4">
            <span className="text-slate-400">Fees Collected</span>
            <span className="font-mono text-emerald-400">+{formatCurrency(fees)}</span>
          </div>
          <div className="grid grid-cols-[1fr_auto] items-baseline gap-4">
            <span className="text-slate-400">AMM Floor Delta</span>
            <span className="font-mono text-cyan-400/70">{ammDelta >= 0 ? '+' : ''}{formatCurrency(ammDelta)}</span>
          </div>
          
          <div className="pt-2 mt-1 border-t border-slate-700">
            <div className="grid grid-cols-[1fr_auto] items-baseline gap-4">
              <span className="text-white font-bold">TVL (Floor Equity)</span>
              <span className="font-mono font-bold text-cyan-400 text-sm">{formatCurrency(tvl)}</span>
            </div>
          </div>

          <div className="pt-2 mt-1 border-t border-slate-800/50 space-y-1">
            <div className="grid grid-cols-[1fr_auto] items-baseline gap-4 text-[10px]">
              <span className="text-slate-500 italic ml-2">Gross Assets (Cash)</span>
              <span className="font-mono text-slate-500">{formatCurrency(grossAssets)}</span>
            </div>
            {totalLocked > 0 && (
              <div className="grid grid-cols-[1fr_auto] items-baseline gap-4 text-[10px]">
                <span className="text-amber-500/70 italic ml-2">- Locked Proceeds</span>
                <span className="font-mono text-amber-500/70">{formatCurrency(totalLocked)}</span>
              </div>
            )}
            <div className="grid grid-cols-[1fr_auto] items-baseline gap-4 text-[10px]">
              <span className="text-rose-500/70 italic ml-2">- Market Liability (Max)</span>
              <span className="font-mono text-rose-500/70">-{formatCurrency(maxLiability)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics - 2x2 Grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="p-2 rounded-lg bg-slate-800/30 text-center">
          <div className="text-[9px] text-slate-500 mb-1">Depth (b)</div>
          <div className="font-mono font-bold text-white">${bParamNum.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
        </div>
        <div className="p-2 rounded-lg bg-slate-800/30 text-center">
          <div className="text-[9px] text-slate-500 mb-1">LP Supply</div>
          <div className="font-mono font-bold text-white truncate px-1" title={lpSupply.toString()}>
            {lpSupply.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="p-2 rounded-lg bg-purple-500/10 text-center border border-purple-500/20">
          <div className="text-[9px] text-purple-400 mb-1 font-semibold uppercase tracking-wider">LP ExRate</div>
          <div className="font-mono font-bold text-purple-400 text-lg">{exchangeRate.toFixed(4)}x</div>
        </div>
        <div className="p-2 rounded-lg bg-amber-500/10 text-center">
          <div className="text-[9px] text-amber-400 mb-1">Max Loss</div>
          <div className="font-mono font-bold text-amber-400">${maxLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
        </div>
      </div>

      {/* LMSR Inventory */}
      <div className="flex gap-2 mb-3">
        <div className="flex-1 p-2 rounded-lg bg-emerald-500/10 text-center">
          <div className="text-[9px] text-emerald-400 mb-1">qYes Outstanding</div>
          <div className="font-mono font-bold text-emerald-400">{qYes.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
        </div>
        <div className="flex-1 p-2 rounded-lg bg-rose-500/10 text-center">
          <div className="text-[9px] text-rose-400 mb-1">qNo Outstanding</div>
          <div className="font-mono font-bold text-rose-400">{qNo.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
        </div>
      </div>

      {/* Settlement Simulation */}
      <div className="p-3 rounded-lg bg-slate-800/30 mb-3">
        <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-2">LP Payout Simulation</div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="text-center">
            <div className="text-[9px] text-emerald-400 mb-1">If YES Wins</div>
            <div className="font-mono font-bold text-white">{formatCurrency(lpPayoutYes)}</div>
          </div>
          <div className="text-center">
            <div className="text-[9px] text-rose-400 mb-1">If NO Wins</div>
            <div className="font-mono font-bold text-white">{formatCurrency(lpPayoutNo)}</div>
          </div>
          <div className="text-center">
            <div className="text-[9px] text-cyan-400 mb-1">Expected</div>
            <div className="font-mono font-bold text-cyan-400">{formatCurrency(expectedPayout)}</div>
          </div>
        </div>
      </div>

      {/* Locked Proceeds (if any) */}
      {totalLockedProceeds && totalLockedProceeds > 0n && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-amber-400 flex items-center gap-2">
              <Lock className="w-3 h-3" />
              <span className="font-medium">Locked Proceeds</span>
            </span>
            <div className="flex gap-4">
              <span className="text-slate-400">Total: <span className="font-mono font-bold text-white">{formatCurrency(parseFloat(formatUnits(totalLockedProceeds, ASSET_DECIMALS)))}</span></span>
              {lockedProceeds && lockedProceeds > 0n && (
                <span className="text-slate-400">Yours: <span className="font-mono font-bold text-amber-400">{formatCurrency(parseFloat(formatUnits(lockedProceeds, ASSET_DECIMALS)))}</span></span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Contract Addresses */}
      <div className="pt-2 border-t border-slate-800">
        <div className="text-[9px] text-slate-600 uppercase tracking-wider mb-2">Contracts</div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px]">
          <a href={`https://sepolia.basescan.org/address/${address}`} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-cyan-400 transition-colors">
            Market <span className="font-mono">{address.slice(0,6)}...{address.slice(-4)}</span>
          </a>
          {creator && (
            <a href={`https://sepolia.basescan.org/address/${creator}`} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-cyan-400 transition-colors">
              Creator <span className="font-mono">{creator.slice(0,6)}...{creator.slice(-4)}</span>
            </a>
          )}
          {outcomeToken && (
            <a href={`https://sepolia.basescan.org/address/${outcomeToken}`} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-cyan-400 transition-colors">
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
            {isGraduatePending ? 'Graduating...' : '🎓 Graduate Market'}
          </Button>
        )}
      </div>
    </Card>
  );
};

// Helper component for address display with copy functionality
const AddressRow = ({ label, address, isCreator }: { label: string; address: string; isCreator?: boolean }) => {
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
          <Badge className="text-[9px] bg-amber-500/20 text-amber-400 border-amber-500/50 py-0 px-1">
            Creator
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-2">
        <a
          href={`https://sepolia.basescan.org/address/${address}`}
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
          href={`https://sepolia.basescan.org/address/${address}`}
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

  const marketData = useLaunchpadMarket(address as `0x${string}`);

  const {
    isGraduated,
    graduationThreshold,
    bBase,
    deadline,
    creator,
    isLive,
    graduate,
    isGraduatePending,
    feesAccrued,
    outcomeToken,
    totalCreatorDeposit,
    // V6: LP Token data
    totalSupply,
    totalAssets,
    totalNetAssets,
    ammReserve,
    userLpBalance,
    userLpValue,
    userSharePercent,
    totalLockedProceeds,
    lockedProceeds,
    // V6: LP actions
    redeemLP,
    isRedeemLPPending,
  } = marketData;

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

  // Fetch creator's LP balance (for leaderboard)
  const { data: creatorLpData } = useReadContracts({
    contracts: creator && address ? [
      { address: address as `0x${string}`, abi: LAUNCHPAD_MARKET_ABI, functionName: 'balanceOf', args: [creator] },
    ] : [],
    query: {
      enabled: !!creator && !!address,
      refetchInterval: 15000,
    },
  });
  const creatorLpBalance = creatorLpData?.[0]?.result as bigint | undefined;

  const directName = directTokenData?.[0]?.result as string | undefined;
  const directSymbol = directTokenData?.[1]?.result as string | undefined;

  // Use marketMeta if available, otherwise use direct fetch, otherwise fallback
  const displayName = marketMeta?.name || directName || 'Loading...';
  const displaySymbol = marketMeta?.symbol || directSymbol || '???';

  const { market, isLoading: marketLoading } = useAmmMarketByAddress(
    address as `0x${string}`,
    marketMeta || (directName || directSymbol) ? {
      address: address as `0x${string}`,
      name: displayName,
      symbol: displaySymbol,
      isGraduated: isGraduated || false,
      deadline: deadline ? Number(deadline) : undefined,
    } : undefined
  );

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
  const priceYes = market?.priceYes ?? 0.5;
  const priceNo = 1 - priceYes;
  const graduationProgress = bBase && graduationThreshold
    ? Math.min(100, Number((bBase * 100n) / graduationThreshold))
    : 0;

  // LMSR parameters for display
  const bParamNum = market?.bParam ? parseFloat(formatUnits(BigInt(market.bParam.toString()), 18)) : 1000;
  const qYes = market?.qYes ? parseFloat(formatUnits(BigInt(market.qYes.toString()), 18)) : 0;
  const qNo = market?.qNo ? parseFloat(formatUnits(BigInt(market.qNo.toString()), 18)) : 0;

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
            {isGraduated ? (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/50">
                🎓 Graduated
              </Badge>
            ) : isExpired ? (
              <Badge className="bg-red-500/20 text-red-400 border-red-500/50">
                ⏰ Expired
              </Badge>
            ) : (
              <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/50">
                🔥 Bonding
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <a
              href={`https://sepolia.basescan.org/address/${address}`}
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
            priceYes={priceYes}
            priceNo={priceNo}
            totalAssets={totalAssets}
            totalNetAssets={totalNetAssets}
            totalSupply={totalSupply}
            totalCreatorDeposit={totalCreatorDeposit}
            feesAccrued={feesAccrued}
            ammReserve={ammReserve}
            bParamNum={bParamNum}
            qYes={qYes}
            qNo={qNo}
            totalLockedProceeds={totalLockedProceeds}
            lockedProceeds={lockedProceeds}
            address={address}
            creator={creator}
            outcomeToken={outcomeToken}
          />

          {/* Orderbook Trading (Post-Graduation Only) */}
          {isGraduated && address && (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-purple-400" />
                  Orderbook Trading
                </h3>
                <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/50">
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
              userLpValue={userLpValue || 0n}
              userSharePercent={userSharePercent || 0}
              isLive={isLive}
              redeemLP={redeemLP}
              isRedeemLPPending={isRedeemLPPending}
              creatorAddress={creator}
              creatorLpBalance={creatorLpBalance}
              totalSupply={totalSupply}
              totalAssets={totalAssets}
              totalNetAssets={totalNetAssets}
            />

            {/* Trading Panel */}
            <MarketCard
              address={address as `0x${string}`}
              name={displayName}
              symbol={displaySymbol}
              isGraduated={isGraduated}
              deadline={marketMeta?.deadline ? Number(marketMeta.deadline) : (deadline ? Number(deadline) : undefined)}
              disableNavigation={true}
              market={market}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

