/**
 * Pro Page - TickBook Trading Terminal
 * 
 * Professional orderbook interface for graduated markets.
 * Redesigned with Premium "Cyber-Glass" Aesthetics.
 * 
 * Features:
 * - High-performance virtualized-style orderbook
 * - Bespoke dual-thumb range slider
 * - Neon glassmorphism UI
 */
import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Zap, ChevronLeft, Wallet, ArrowUpRight, ArrowDownRight, GraduationCap
} from 'lucide-react';
import { useAccount, useChainId, useWriteContract, useReadContract } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import {
  useLaunchpadMarketDirect,
  useTruthMarketDirect,
  useCollateralizerDirect,
  useTickBookDirect,
  useTokenBalances
} from '../hooks/v8';
import { useDeployments } from '../hooks/useDeployments';
import { V8_ABIS } from '../config/abis';
import marketsConfig from '../config/markets.json';
import { cn } from '../lib/utils';

// Import refactored components
import { GlassPanel, PanelHeader } from '../components/features/v8/ProTerminal/ui-components';
import { CyberSlider } from '../components/features/v8/ProTerminal/CyberSlider';
import { Orderbook } from '../components/features/v8/ProTerminal/Orderbook';
import { UserHistory } from '../components/features/v8/ProTerminal/UserHistory';

// ============================================================================
// Main Component
// ============================================================================

export const Pro = () => {
  const { marketId } = useParams<{ marketId?: string }>();
  const navigate = useNavigate();
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { contracts } = useDeployments();
  const { writeContractAsync } = useWriteContract();

  // --------------------------------------------------------------------------
  // Data Fetching & Prep
  // --------------------------------------------------------------------------
  const { v8Markets, selectedMarket } = useMemo(() => {
    const markets = marketsConfig.markets.filter(m => m.version === 'v8.1' && m.chainId === chainId);
    return {
      v8Markets: markets,
      selectedMarket: marketId ? markets.find(m => m.contractAddress.toLowerCase() === marketId.toLowerCase()) : markets[0]
    };
  }, [marketId, chainId]);

  const marketAddr = selectedMarket?.contractAddress as `0x${string}`;
  const { launchpad } = useLaunchpadMarketDirect(marketAddr);
  const { collateralizer, isLoading: isTokensLoading } = useCollateralizerDirect(marketAddr);

  const { tickBook, isLoading: isTickBookLoading, refetch: refetchTickBook } = useTickBookDirect(
    marketAddr,
    collateralizer?.yesToken,
    collateralizer?.noToken
  );

  const { balances, refetch: refetchBalances } = useTokenBalances(useMemo(() => [
    contracts.MockUSDC as `0x${string}`,
    collateralizer?.yesToken as `0x${string}`,
    collateralizer?.noToken as `0x${string}`
  ].filter(Boolean) as `0x${string}`[], [contracts.MockUSDC, collateralizer]));

  // Fetch USDC decimals for proper formatting (Bug #4)
  const { data: usdcDecimals } = useReadContract({
    address: contracts.MockUSDC as `0x${string}`,
    abi: V8_ABIS.OutcomeToken,
    functionName: 'decimals',
    query: { 
      enabled: !!contracts.MockUSDC,
      staleTime: Infinity,
      refetchInterval: false,
    },
  });
  const decimals = Number(usdcDecimals ?? 18);

  // Safely extract balances with defaults
  const usdcBalance = balances[0] ?? 0n;
  const yesBalance = collateralizer?.yesToken ? (balances[1] ?? 0n) : 0n;
  const noBalance = collateralizer?.noToken ? (balances[2] ?? 0n) : 0n;

  // --------------------------------------------------------------------------
  // UI State
  // --------------------------------------------------------------------------
  const [outcome, setOutcome] = useState<'yes' | 'no'>('yes');
  const [tradeMode, setTradeMode] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'limit' | 'market'>('limit');
  const [priceMode, setPriceMode] = useState<'ranged' | 'single'>('ranged');

  // Tabs for Inventory/History
  const [activeTab, setActiveTab] = useState<'inventory' | 'history'>('inventory');

  // Price Inputs
  const [range, setRange] = useState<[number, number]>([45, 55]);
  const [lowerInput, setLowerInput] = useState('45');
  const [upperInput, setUpperInput] = useState('55');
  const [sizeInput, setSizeInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Bug #5: Prevent negative price inputs
  const handlePriceInputChange = (val: string, isLower: boolean) => {
    if (val === '') {
      isLower ? setLowerInput('') : setUpperInput('');
      return;
    }
    const num = parseFloat(val);
    if (isNaN(num)) return;
    if (num < 0) return; 
    if (num > 100) return;
    isLower ? setLowerInput(val) : setUpperInput(val);
  };

  // Sync Slider <-> Inputs
  const handleSliderChange = (newRange: [number, number]) => {
    setRange(newRange);
    setLowerInput(newRange[0].toString());
    setUpperInput(newRange[1].toString());
  };

  const handleInputBlur = () => {
    let l = Math.max(1, Math.min(99, parseFloat(lowerInput) || 45));
    let u = Math.max(1, Math.min(99, parseFloat(upperInput) || 55));

    if (priceMode === 'single') u = l;
    else if (l > u) u = l;

    setRange([l, u]);
    setLowerInput(l.toString());
    setUpperInput(u.toString());
  };

  // Orderbook Logic
  const handleTickClick = (price: number, side: 'buy' | 'sell') => {
    const p = price * 100;
    setPriceMode('single'); // Auto-switch to single for precise clicking
    setRange([p, p]);
    setLowerInput(p.toFixed(2));
    setUpperInput(p.toFixed(2));
    setTradeMode(side);
    setOrderType('limit');
  };

  // --------------------------------------------------------------------------
  // Execution Logic
  // --------------------------------------------------------------------------
  const getActionLabel = () => {
    if (orderType === 'market') return `${tradeMode === 'buy' ? 'Buy' : 'Sell'} ${outcome.toUpperCase()}`;
    return `Place ${tradeMode === 'buy' ? 'Buy' : 'Sell'} Order`;
  };

  const executeTrade = async () => {
    if (!sizeInput || !tickBook?.marketKey) return;
    setIsSubmitting(true);
    const amountBg = parseUnits(sizeInput, 18);

    try {
      if (orderType === 'market') {
        const isBuyYes = (outcome === 'yes' && tradeMode === 'buy') || (outcome === 'no' && tradeMode === 'sell');
        await writeContractAsync({
          address: contracts.TickBook as `0x${string}`,
          abi: V8_ABIS.TickBook,
          functionName: 'executeMarketOrder',
          args: [tickBook.marketKey, isBuyYes, amountBg, isBuyYes ? 9999 : 0]
        });
      } else {
        const t1 = Math.round((parseFloat(lowerInput) / 100) * 10000);
        const t2 = priceMode === 'single' ? t1 : Math.round((parseFloat(upperInput) / 100) * 10000);
        await writeContractAsync({
          address: contracts.TickBook as `0x${string}`,
          abi: V8_ABIS.TickBook,
          functionName: 'placeLimitOrder',
          args: [tickBook.marketKey, Math.min(t1, t2), Math.max(t1, t2), amountBg]
        });
      }
      refetchTickBook();
      refetchBalances();
      setSizeInput('');
    } catch (e) { console.error(e); } finally { setIsSubmitting(false); }
  };

  const doAction = async (method: 'split' | 'merge') => {
    if (!sizeInput) return;
    setIsSubmitting(true);
    try {
      await writeContractAsync({
        address: contracts.Collateralizer as `0x${string}`,
        abi: V8_ABIS.Collateralizer,
        functionName: method,
        args: [marketAddr, parseUnits(sizeInput, 18)]
      });
      refetchBalances();
    } catch (e) { console.error(e); } finally { setIsSubmitting(false); }
  };

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------
  if (!launchpad?.isGraduated && !isTickBookLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950">
        <GlassPanel className="max-w-md p-8 text-center border-amber-500/30 bg-amber-900/10">
          <Zap className="w-12 h-12 text-amber-500 mx-auto mb-4 animate-pulse" />
          <h2 className="text-xl font-heading text-white mb-2">TickBook Restricted</h2>
          <Button variant="primary" onClick={() => navigate(`/trade/${marketAddr}`)} className="w-full mt-4">Go to AMM</Button>
        </GlassPanel>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      {/* 1. Header Section */}
      <div className="max-w-[1600px] mx-auto px-4 pt-6 pb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link to="/trade" className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-heading gradient-text font-bold tracking-tight">
                  {selectedMarket?.name}
                </h1>
                <div className="flex items-center gap-2">
                  <Badge variant="indigo" className="font-mono text-xs border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
                    V8.1 TICKBOOK
                  </Badge>
                  <Badge variant="success" className="font-mono text-xs border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                    <GraduationCap className="w-3 h-3 mr-1" />
                    GRADUATED
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 font-mono">
                <span className="flex items-center gap-1.5"><div className="status-dot live" /> LIVE</span>
                <span>ID: {selectedMarket?.symbol}</span>
                <span>NET: {chainId}</span>
              </div>
            </div>
          </div>

          {/* Market Ticker */}
          <div className="flex gap-2">
            {v8Markets.slice(0, 4).map(m => (
              <button
                key={m.id}
                onClick={() => navigate(`/pro/${m.contractAddress}`)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all font-mono border",
                  selectedMarket?.id === m.id
                    ? "bg-slate-800 border-cyan-500/50 text-cyan-400 shadow-[0_0_15px_-5px_rgba(6,182,212,0.3)]"
                    : "bg-slate-900/50 border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-300"
                )}
              >
                {m.symbol}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-200px)] min-h-[600px]">

          {/* LEFT: Orderbook (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-4 h-full">
            <Orderbook
              bids={tickBook?.bids ?? []}
              asks={tickBook?.asks ?? []}
              currentTick={tickBook?.currentTick ?? 5000}
              isLoading={isTickBookLoading}
              onRefresh={refetchTickBook}
              onTickClick={handleTickClick}
            />
          </div>

          {/* RIGHT: Trading & Positions (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-6 h-full overflow-y-auto pr-1">

            {/* 1. Trading Panel */}
            <GlassPanel className="p-0 overflow-visible relative">
              <PanelHeader title="EXECUTION" icon={Zap} />
              <div className="p-6 space-y-6">

                {/* Top Controls: Outcome & Action */}
                <div className="grid grid-cols-2 gap-6">
                  {/* Outcome Selector */}
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Outcome</label>
                    <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-lg border border-slate-800">
                      <button onClick={() => setOutcome('yes')} className={cn("py-2 rounded px-2 text-xs font-bold transition-all", outcome === 'yes' ? "bg-emerald-500/20 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]" : "text-slate-500 hover:text-slate-300")}>YES</button>
                      <button onClick={() => setOutcome('no')} className={cn("py-2 rounded px-2 text-xs font-bold transition-all", outcome === 'no' ? "bg-rose-500/20 text-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.2)]" : "text-slate-500 hover:text-slate-300")}>NO</button>
                    </div>
                  </div>

                  {/* Action Selector */}
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Action</label>
                    <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-lg border border-slate-800">
                      <button onClick={() => setTradeMode('buy')} className={cn("py-2 rounded px-2 text-xs font-bold transition-all", tradeMode === 'buy' ? "bg-emerald-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300")}>BUY</button>
                      <button onClick={() => setTradeMode('sell')} className={cn("py-2 rounded px-2 text-xs font-bold transition-all", tradeMode === 'sell' ? "bg-rose-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300")}>SELL</button>
                    </div>
                  </div>
                </div>

                {/* Order Type Tabs */}
                <div className="flex border-b border-slate-800">
                  {['limit', 'market'].map((type) => (
                    <button
                      key={type}
                      onClick={() => setOrderType(type as any)}
                      className={cn(
                        "px-6 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all",
                        orderType === type
                          ? "border-cyan-500 text-cyan-400"
                          : "border-transparent text-slate-500 hover:text-slate-300"
                      )}
                    >
                      {type} Order
                    </button>
                  ))}
                </div>

                {/* PRICE INPUTS (Limit Only) */}
                {orderType === 'limit' && (
                  <div className="space-y-6 animate-fade-in-up">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-400">Price Range (%)</label>
                      <div className="flex bg-slate-900 rounded p-0.5 border border-slate-800">
                        <button onClick={() => setPriceMode('single')} className={cn("px-2 py-0.5 text-[10px] font-bold uppercase rounded", priceMode === 'single' ? "bg-slate-700 text-white" : "text-slate-500")}>Single</button>
                        <button onClick={() => setPriceMode('ranged')} className={cn("px-2 py-0.5 text-[10px] font-bold uppercase rounded", priceMode === 'ranged' ? "bg-slate-700 text-white" : "text-slate-500")}>Ranged</button>
                      </div>
                    </div>

                    <CyberSlider
                      value={range}
                      onChange={handleSliderChange}
                      isSingle={priceMode === 'single'}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-500 font-mono">LOWER BOUND</span>
                        <input className="input-field bg-slate-950 font-bold text-lg" value={lowerInput} onChange={e => handlePriceInputChange(e.target.value, true)} onBlur={handleInputBlur} type="number" />
                      </div>
                      {priceMode === 'ranged' && (
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-500 font-mono">UPPER BOUND</span>
                          <input className="input-field bg-slate-950 font-bold text-lg" value={upperInput} onChange={e => handlePriceInputChange(e.target.value, false)} onBlur={handleInputBlur} type="number" />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* AMOUNT INPUT */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <label className="text-xs font-bold text-slate-400">Amount</label>
                    <span className="text-xs font-mono text-slate-500">
                      Bal: {parseFloat(formatUnits(orderType === 'market' ? usdcBalance : (outcome === 'yes' ? yesBalance : noBalance), orderType === 'market' ? decimals : 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      className="input-field bg-slate-950 text-xl font-bold tracking-tight"
                      placeholder="0.00"
                      type="number"
                      value={sizeInput}
                      onChange={e => setSizeInput(e.target.value)}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs">
                      {orderType === 'market' ? 'USDC' : 'SHARES'}
                    </span>
                  </div>
                </div>

                {/* EXECUTE BUTTON */}
                <Button
                  onClick={executeTrade}
                  disabled={!isConnected || !sizeInput || isSubmitting}
                  className={cn(
                    "w-full h-12 text-lg font-bold uppercase tracking-widest shadow-xl transition-all hover:scale-[1.01] active:scale-[0.99]",
                    tradeMode === 'buy' ? "btn-buy" : "btn-sell"
                  )}
                >
                  {isSubmitting ? 'PROCESSING...' : getActionLabel()}
                </Button>

              </div>
            </GlassPanel>

            {/* 2. Inventory / History Manager */}
            {activeTab === 'inventory' ? (
              <GlassPanel className="flex-1 min-h-[250px] p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-bold text-slate-100 uppercase tracking-wider">Inventory</span>
                  </div>
                  <button onClick={() => setActiveTab('history')} className="text-xs text-slate-500 hover:text-white transition-colors">
                    View History →
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex flex-col items-center">
                    <span className="text-[10px] text-slate-500 font-mono mb-1">USDC</span>
                    <span className="font-mono text-white font-bold">{parseFloat(formatUnits(usdcBalance, decimals)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  </div>
                  <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-900/50 flex flex-col items-center">
                    <span className="text-[10px] text-emerald-500 font-mono mb-1">YES</span>
                    <span className="font-mono text-white font-bold">{parseFloat(formatUnits(yesBalance, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  </div>
                  <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-900/50 flex flex-col items-center">
                    <span className="text-[10px] text-rose-500 font-mono mb-1">NO</span>
                    <span className="font-mono text-white font-bold">{parseFloat(formatUnits(noBalance, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Button variant="secondary" onClick={() => doAction('split')} disabled={!sizeInput} className="text-xs">
                    <ArrowUpRight className="w-3 h-3 mr-2" /> SPLIT USDC
                  </Button>
                  <Button variant="secondary" onClick={() => doAction('merge')} disabled={!sizeInput} className="text-xs">
                    <ArrowDownRight className="w-3 h-3 mr-2" /> MERGE TOKENS
                  </Button>
                </div>
              </GlassPanel>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setActiveTab('inventory')}
                  className="absolute top-3 right-4 z-10 text-xs text-slate-500 hover:text-white transition-colors"
                >
                  ← Back to Inventory
                </button>
                <UserHistory />
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default Pro;
