/**
 * Pro Page - TickBook Trading Terminal
 * 
 * V3 Redesign: Unified header with market list + trading terminal
 * 
 * Features:
 * - Unified header with AMM page (search, categories)
 * - Shows only graduated markets
 * - Click to open trading terminal for selected market
 */
import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Zap, Wallet, ArrowUpRight, ArrowDownRight, RefreshCw, ChevronDown, AlertCircle, Loader2, ArrowLeft, BookOpen, TrendingUp, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useAccount, useChainId, useWriteContract, useReadContract } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { Button } from '../components/ui/Button';
import { MarketHeader } from '../components/features/v8';
import {
  useLaunchpadMarketDirect,
  useCollateralizerDirect,
  useTickBookDirect,
  useTickBookVaultDirect,
  useTokenBalances
} from '../hooks/v8';
import { useDeployments } from '../hooks/useDeployments';
import { V8_ABIS } from '../config/abis';
import marketsConfig from '../config/markets.json';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';
import { useChainStore } from '../store/useChainStore';

// ============================================================================
// Types
// ============================================================================
type OrderAction = 'buy_yes' | 'sell_yes' | 'buy_no' | 'sell_no';
type OrderType = 'limit' | 'market';

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'politics', label: 'Politics' },
  { id: 'science', label: 'Science' },
  { id: 'sports', label: 'Sports' },
];

// ============================================================================
// Main Component
// ============================================================================
export const Pro = () => {
  const { marketId } = useParams<{ marketId?: string }>();
  const navigate = useNavigate();
  const { selectedChainId } = useChainStore();
  const chainId = typeof selectedChainId === 'number' ? selectedChainId : Number(selectedChainId);

  // If marketId is provided, show the trading terminal
  // Otherwise, show the market list
  if (marketId) {
    return <ProTradingTerminal marketId={marketId} />;
  }

  return <ProMarketList chainId={chainId} />;
};

// ============================================================================
// Market List View (Horizontal scroll as part of header)
// ============================================================================
const ProMarketList = ({ chainId }: { chainId: number }) => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Get all V8 markets
  const allMarkets = useMemo(() => {
    return marketsConfig.markets?.filter(m =>
      m.chainId === chainId && m.version.startsWith('v8')
    ) || [];
  }, [chainId]);

  // Filter by search and category
  const filteredMarkets = useMemo(() => {
    return allMarkets.filter(m => {
      const matchesSearch = !search || 
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.symbol.toLowerCase().includes(search.toLowerCase());
      
      const matchesCategory = category === 'all' || 
        m.category?.toLowerCase() === category.toLowerCase();
      
      return matchesSearch && matchesCategory;
    });
  }, [allMarkets, search, category]);

  // Generate category counts
  const categoriesWithCounts = useMemo(() => {
    return CATEGORIES.map(cat => ({
      ...cat,
      count: cat.id === 'all' 
        ? allMarkets.length 
        : allMarkets.filter(m => m.category?.toLowerCase() === cat.id).length
    }));
  }, [allMarkets]);

  // Auto-select first market
  React.useEffect(() => {
    if (filteredMarkets.length > 0 && !selectedMarketId) {
      setSelectedMarketId(filteredMarkets[0].contractAddress);
    }
  }, [filteredMarkets, selectedMarketId]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 300;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const handleMarketSelect = (market: typeof filteredMarkets[0]) => {
    setSelectedMarketId(market.contractAddress);
  };

  const selectedMarket = filteredMarkets.find(m => m.contractAddress === selectedMarketId) || filteredMarkets[0];

  return (
    <div className="space-y-6">
      <MarketHeader
        title="Pro Trading"
        subtitle="Order book trading for graduated markets — deeper liquidity, tighter spreads"
        search={search}
        onSearchChange={setSearch}
        category={category}
        onCategoryChange={setCategory}
        categories={categoriesWithCounts}
        marketCount={filteredMarkets.length}
      />

      {/* Horizontal Market Scroll */}
      {filteredMarkets.length === 0 ? (
        <EmptyState search={search} />
      ) : (
        <>
          <div className="relative">
            {/* Left scroll button */}
            <button
              onClick={() => scroll('left')}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-slate-900/90 border border-slate-700 flex items-center justify-center hover:bg-slate-800 hover:border-slate-600 transition-colors shadow-lg"
            >
              <ChevronLeft className="w-5 h-5 text-slate-400" />
            </button>

            {/* Scrollable container */}
            <div
              ref={scrollRef}
              className="flex gap-3 overflow-x-auto scrollbar-hide px-12 py-2 -mx-4"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {filteredMarkets.map(market => (
                <ProMarketChip
                  key={market.contractAddress}
                  market={market}
                  isSelected={market.contractAddress === selectedMarketId}
                  onClick={() => handleMarketSelect(market)}
                />
              ))}
            </div>

            {/* Right scroll button */}
            <button
              onClick={() => scroll('right')}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-slate-900/90 border border-slate-700 flex items-center justify-center hover:bg-slate-800 hover:border-slate-600 transition-colors shadow-lg"
            >
              <ChevronRight className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {/* Trading Terminal for selected market */}
          {selectedMarket && (
            <ProTradingTerminal marketId={selectedMarket.contractAddress} embedded />
          )}
        </>
      )}
    </div>
  );
};

// ============================================================================
// Market Chip (compact horizontal card)
// ============================================================================
interface ProMarketChipProps {
  market: {
    contractAddress: string;
    name: string;
    symbol: string;
    category?: string;
  };
  isSelected: boolean;
  onClick: () => void;
}

const ProMarketChip = ({ market, isSelected, onClick }: ProMarketChipProps) => {
  const { launchpad, isLoading } = useLaunchpadMarketDirect(market.contractAddress as `0x${string}`);
  const isGraduated = launchpad?.isGraduated;

  return (
    <button
      onClick={onClick}
      disabled={!isGraduated && !isLoading}
      className={cn(
        "flex-shrink-0 flex items-center gap-3 px-4 py-3 rounded-xl border transition-all min-w-[200px]",
        isSelected
          ? "bg-amber-500/10 border-amber-500/50 shadow-lg shadow-amber-500/10"
          : isGraduated
            ? "bg-slate-900/80 border-slate-800 hover:border-slate-700"
            : "bg-slate-900/30 border-slate-800/30 opacity-50 cursor-not-allowed"
      )}
    >
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
        isGraduated 
          ? "bg-gradient-to-br from-amber-500 to-orange-600 text-white"
          : "bg-slate-800 text-slate-500"
      )}>
        {market.symbol.slice(0, 2)}
      </div>
      <div className="text-left min-w-0">
        <div className="font-semibold text-white text-sm truncate">{market.symbol}</div>
        <div className="text-[10px] text-slate-500 truncate">{market.name.slice(0, 25)}</div>
      </div>
      {isLoading ? (
        <Loader2 className="w-4 h-4 text-slate-500 animate-spin flex-shrink-0" />
      ) : isGraduated ? (
        <TrendingUp className="w-4 h-4 text-emerald-400 flex-shrink-0" />
      ) : (
        <Zap className="w-4 h-4 text-amber-500 flex-shrink-0" />
      )}
    </button>
  );
};

// ============================================================================
// Pro Market Card (shows graduation status)
// ============================================================================
interface ProMarketCardProps {
  market: {
    contractAddress: string;
    name: string;
    symbol: string;
    category?: string;
  };
  onClick: () => void;
}

const ProMarketCard = ({ market, onClick }: ProMarketCardProps) => {
  const { launchpad, isLoading } = useLaunchpadMarketDirect(market.contractAddress as `0x${string}`);
  const isGraduated = launchpad?.isGraduated;

  return (
    <button
      onClick={onClick}
      disabled={!isGraduated && !isLoading}
      className={cn(
        "w-full p-5 rounded-2xl border text-left transition-all",
        isGraduated 
          ? "bg-gradient-to-b from-slate-900/80 to-slate-950/80 border-slate-800/50 hover:border-amber-500/50 hover:shadow-lg hover:shadow-amber-500/5 cursor-pointer"
          : "bg-slate-900/30 border-slate-800/30 cursor-not-allowed opacity-60"
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold",
            isGraduated 
              ? "bg-gradient-to-br from-amber-500 to-orange-600 text-white"
              : "bg-slate-800 text-slate-500"
          )}>
            {market.symbol.slice(0, 2)}
          </div>
          <div>
            <div className="font-semibold text-white">{market.symbol}</div>
            <div className="text-xs text-slate-500">{market.category || 'Uncategorized'}</div>
          </div>
        </div>
        
        {/* Status Badge */}
        {isLoading ? (
          <span className="px-2 py-1 rounded-full bg-slate-800 text-slate-400 text-[10px] font-medium">
            Loading...
          </span>
        ) : isGraduated ? (
          <span className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-medium flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            Graduated
          </span>
        ) : (
          <span className="px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-medium">
            Pre-Graduation
          </span>
        )}
      </div>

      <div className="text-sm text-slate-400 line-clamp-2 mb-3">{market.name}</div>

      {!isGraduated && !isLoading && (
        <div className="text-xs text-slate-500 flex items-center gap-1">
          <Zap className="w-3 h-3" />
          Trade on AMM first
        </div>
      )}
    </button>
  );
};

// ============================================================================
// Empty State
// ============================================================================
const EmptyState = ({ search }: { search?: string }) => (
  <div className="text-center py-20">
    <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-slate-900/50 border border-dashed border-slate-700 flex items-center justify-center">
      <BookOpen className="w-8 h-8 text-slate-600" />
    </div>
    <h3 className="text-xl font-bold text-white mb-2">
      {search ? 'No markets found' : 'No Graduated Markets'}
    </h3>
    <p className="text-slate-400 mb-6 max-w-md mx-auto">
      {search 
        ? `No markets match "${search}". Try a different search term.`
        : 'Pro trading is available for graduated markets. Check the AMM for early-stage markets.'
      }
    </p>
    <Link to="/v8" className="text-amber-400 hover:text-amber-300 text-sm font-medium">
      Browse AMM Markets →
    </Link>
  </div>
);

// ============================================================================
// Trading Terminal
// ============================================================================
const ProTradingTerminal = ({ marketId, embedded = false }: { marketId: string; embedded?: boolean }) => {
  const navigate = useNavigate();
  const { isConnected, address: userAddress } = useAccount();
  const chainId = useChainId();
  const { contracts } = useDeployments();
  const { writeContractAsync } = useWriteContract();

  // UI State
  const [action, setAction] = useState<OrderAction>('buy_yes');
  const [orderType, setOrderType] = useState<OrderType>('limit');
  const [priceMode, setPriceMode] = useState<'single' | 'range'>('single');
  const [priceLow, setPriceLow] = useState('45.0');
  const [priceHigh, setPriceHigh] = useState('55.0');
  const [amount, setAmount] = useState('1');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showVaultPanel, setShowVaultPanel] = useState(false);
  const [vaultInput, setVaultInput] = useState('');

  // Data
  const { v8Markets, selectedMarket } = useMemo(() => {
    const markets = marketsConfig.markets.filter(m => m.version.startsWith('v8') && m.chainId === chainId);
    return {
      v8Markets: markets,
      selectedMarket: markets.find(m => m.contractAddress.toLowerCase() === marketId.toLowerCase())
    };
  }, [marketId, chainId]);

  const marketAddr = selectedMarket?.contractAddress as `0x${string}`;
  const { launchpad } = useLaunchpadMarketDirect(marketAddr);
  const { collateralizer } = useCollateralizerDirect(marketAddr);
  const { tickBook, isLoading: isTickBookLoading, refetch: refetchTickBook } = useTickBookDirect(
    marketAddr,
    collateralizer?.yesToken,
    collateralizer?.noToken
  );
  const { vault, refetch: refetchVault } = useTickBookVaultDirect(userAddress, marketAddr);

  const { balances, refetch: refetchBalances } = useTokenBalances(useMemo(() => [
    contracts.MockUSDC as `0x${string}`
  ].filter(Boolean) as `0x${string}`[], [contracts.MockUSDC]));

  const { data: usdcDecimals } = useReadContract({
    address: contracts.MockUSDC as `0x${string}`,
    abi: V8_ABIS.OutcomeToken,
    functionName: 'decimals',
    query: { enabled: !!contracts.MockUSDC, staleTime: Infinity },
  });
  const decimals = Number(usdcDecimals ?? 18);

  const walletUsdc = balances[0] ?? 0n;
  const vaultAvailable = vault?.availableUsdcWad ?? 0n;
  const vaultReserved = vault?.reservedUsdcWad ?? 0n;

  // Approval check
  const { data: vaultAllowance, refetch: refetchAllowance } = useReadContract({
    address: contracts.MockUSDC as `0x${string}`,
    abi: V8_ABIS.OutcomeToken,
    functionName: 'allowance',
    args: isConnected && contracts.TickBookVault ? [userAddress!, contracts.TickBookVault as `0x${string}`] : undefined,
    query: { enabled: !!isConnected && !!contracts.TickBookVault && !!contracts.MockUSDC }
  });

  const needsApproval = useMemo(() => {
    return ((vaultAllowance as bigint) ?? 0n) < parseUnits('1000', decimals);
  }, [vaultAllowance, decimals]);

  // Derived values
  const currentProb = tickBook?.probability ?? 0.5;
  const priceLowNum = parseFloat(priceLow) || 45;
  const priceHighNum = parseFloat(priceHigh) || 55;
  const amountNum = parseFloat(amount) || 0;
  const numTicks = priceMode === 'single' ? 1 : Math.max(1, Math.round((priceHighNum - priceLowNum) * 10) + 1);
  const avgPrice = priceMode === 'single' ? priceLowNum : (priceLowNum + priceHighNum) / 2;
  
  // Calculate required collateral based on action
  const isBuying = action === 'buy_yes' || action === 'buy_no';
  const isYes = action === 'buy_yes' || action === 'sell_yes';
  
  // For buys: cost to acquire shares
  // For sells: value you receive for selling shares
  const estimatedValue = useMemo(() => {
    if (!amountNum) return 0;
    const p = avgPrice / 100;
    if (action === 'buy_yes') return amountNum * p;
    if (action === 'buy_no') return amountNum * (1 - p);
    if (action === 'sell_yes') return amountNum * p;
    if (action === 'sell_no') return amountNum * (1 - p);
    return 0;
  }, [amountNum, avgPrice, action]);

  const hasEnoughBalance = isBuying 
    ? vaultAvailable >= parseUnits(estimatedValue.toFixed(2), 18)
    : true; // For sells, check if user has enough shares (handled separately)

  // Handlers
  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      await writeContractAsync({
        address: contracts.MockUSDC as `0x${string}`,
        abi: V8_ABIS.OutcomeToken,
        functionName: 'approve',
        args: [contracts.TickBookVault as `0x${string}`, parseUnits('1000000000', decimals)]
      });
      refetchAllowance();
      toast.success('Vault approved!');
    } catch (e) {
      toast.error('Approval failed');
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeposit = async () => {
    if (!vaultInput) return;
    setIsSubmitting(true);
    try {
      await writeContractAsync({
        address: contracts.TickBookVault as `0x${string}`,
        abi: V8_ABIS.TickBookVault,
        functionName: 'depositUsdc',
        args: [parseUnits(vaultInput, decimals)]
      });
      refetchBalances();
      refetchVault();
      setVaultInput('');
      toast.success(`Deposited $${vaultInput}`);
    } catch (e) {
      toast.error('Deposit failed');
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    if (!vaultInput) return;
    setIsSubmitting(true);
    try {
      await writeContractAsync({
        address: contracts.TickBookVault as `0x${string}`,
        abi: V8_ABIS.TickBookVault,
        functionName: 'withdrawUsdc',
        args: [parseUnits(vaultInput, 18)]
      });
      refetchBalances();
      refetchVault();
      setVaultInput('');
      toast.success(`Withdrew $${vaultInput}`);
    } catch (e) {
      toast.error('Withdrawal failed');
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTrade = async () => {
    if (!amount || !tickBook?.marketKey) return;
    setIsSubmitting(true);
    const amountBg = parseUnits(amount, 18);

    // Determine outcome: YES=1, NO=0
    const outcome = isYes ? 1 : 0;

    try {
      // Selling is placing a limit order on the opposite side
      // sell_yes @ P = buy_no @ (1-P) from maker perspective
      // For now, we treat sell as placing a limit order that others can take
      
      if (orderType === 'market') {
        await writeContractAsync({
          address: contracts.TickBook as `0x${string}`,
          abi: V8_ABIS.TickBook,
          functionName: 'executeMarketOrder',
          args: [tickBook.marketKey, outcome, amountBg, outcome === 1 ? 999 : 0]
        });
        toast.success('Market order executed!');
      } else {
        const tickLow = Math.round(priceLowNum * 10);
        const tickHigh = priceMode === 'single' ? tickLow : Math.round(priceHighNum * 10);
        const tickCount = BigInt(tickHigh - tickLow + 1);
        const sharesPerTick = amountBg / tickCount;
        await writeContractAsync({
          address: contracts.TickBook as `0x${string}`,
          abi: V8_ABIS.TickBook,
          functionName: 'placeLimitOrder',
          args: [tickBook.marketKey, outcome, tickLow, tickHigh, sharesPerTick]
        });
        toast.success(priceMode === 'single' ? 'Limit order placed!' : `Range order placed across ${tickCount} ticks!`);
      }
      refetchTickBook();
      refetchVault();
      setAmount('');
    } catch (e) {
      const msg = (e as any)?.cause?.reason || (e as any)?.shortMessage || 'Trade failed';
      toast.error(msg);
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Not graduated
  if (!launchpad?.isGraduated && !isTickBookLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md p-8 rounded-2xl bg-gradient-to-b from-amber-950/20 to-transparent border border-amber-900/30 text-center">
          <Zap className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Pro Trading Locked</h2>
          <p className="text-slate-400 mb-6">This market hasn't graduated yet. Trade on the AMM first.</p>
          <Button onClick={() => navigate(`/trade/${marketAddr}`)} className="w-full bg-amber-600 hover:bg-amber-500 text-white">
            Go to AMM Trading
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button + Market Info (hidden when embedded) */}
      {!embedded && (
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/pro')}
            className="p-2 rounded-lg bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-sm font-bold">
              {selectedMarket?.symbol?.slice(0, 2) || 'PR'}
            </div>
            <div>
              <div className="font-semibold text-white">{selectedMarket?.symbol || 'Select Market'}</div>
              <div className="text-xs text-slate-500">{selectedMarket?.name?.slice(0, 50) || '—'}</div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <div className="text-center">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Current Prob</div>
              <div className="text-2xl font-mono font-bold text-amber-400">{(currentProb * 100).toFixed(1)}%</div>
            </div>
            <button onClick={() => refetchTickBook()} className="p-2 rounded-lg hover:bg-slate-800 transition-colors">
              <RefreshCw className={cn("w-4 h-4 text-slate-500", isTickBookLoading && "animate-spin")} />
            </button>
          </div>
        </div>
      )}

      {/* Embedded: Compact header with current prob */}
      {embedded && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Current Prob</div>
              <div className="text-2xl font-mono font-bold text-amber-400">{(currentProb * 100).toFixed(1)}%</div>
            </div>
          </div>
          <button onClick={() => refetchTickBook()} className="p-2 rounded-lg hover:bg-slate-800 transition-colors">
            <RefreshCw className={cn("w-4 h-4 text-slate-500", isTickBookLoading && "animate-spin")} />
          </button>
        </div>
      )}

      {/* Vault Bar */}
      <div className="rounded-xl bg-slate-900/50 border border-slate-800 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-amber-500" />
              <span className="text-sm text-slate-400">Vault</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div>
                <span className="text-slate-500">Wallet:</span>
                <span className="ml-2 font-mono text-white">${parseFloat(formatUnits(walletUsdc, decimals)).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-500">Available:</span>
                <span className="ml-2 font-mono text-emerald-400">${parseFloat(formatUnits(vaultAvailable, 18)).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-500">In Orders:</span>
                <span className="ml-2 font-mono text-amber-400">${parseFloat(formatUnits(vaultReserved, 18)).toLocaleString()}</span>
              </div>
            </div>
          </div>
          
          <button
            onClick={() => setShowVaultPanel(!showVaultPanel)}
            className="text-sm text-amber-400 hover:text-amber-300 flex items-center gap-1"
          >
            {showVaultPanel ? 'Hide' : 'Manage'} <ChevronDown className={cn("w-4 h-4 transition-transform", showVaultPanel && "rotate-180")} />
          </button>
        </div>

        {showVaultPanel && (
          <div className="mt-4 pt-4 border-t border-slate-800 flex items-center gap-3">
            <input
              type="number"
              placeholder="Amount"
              value={vaultInput}
              onChange={(e) => setVaultInput(e.target.value)}
              className="w-32 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm font-mono focus:border-amber-500 focus:outline-none"
            />
            {needsApproval ? (
              <Button onClick={handleApprove} disabled={isSubmitting} className="bg-amber-600 hover:bg-amber-500 text-white text-sm px-4">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Approve USDC'}
              </Button>
            ) : (
              <>
                <Button onClick={handleDeposit} disabled={!vaultInput || isSubmitting} className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm px-4">
                  <ArrowUpRight className="w-4 h-4 mr-1" /> Deposit
                </Button>
                <Button onClick={handleWithdraw} disabled={!vaultInput || isSubmitting} className="bg-slate-700 hover:bg-slate-600 text-white text-sm px-4">
                  <ArrowDownRight className="w-4 h-4 mr-1" /> Withdraw
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT: Orderbook Visualization */}
        <div className="lg:col-span-2 space-y-4">
          {/* Pixel Liquidity Map */}
          <div className="rounded-2xl bg-gradient-to-b from-slate-900/80 to-slate-950/80 border border-slate-800/50 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800/50 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Liquidity Map</span>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="text-emerald-400">◀ YES Bids</span>
                <span className="text-amber-400 font-bold">{(currentProb * 100).toFixed(1)}%</span>
                <span className="text-rose-400">NO Asks ▶</span>
              </div>
            </div>
            
            <div className="p-4">
              {/* Single Row Heatmap - Height = Depth */}
              <div className="relative">
                {/* Price scale */}
                <div className="flex justify-between text-[9px] text-slate-600 font-mono mb-1 px-1">
                  <span>0%</span>
                  <span>25%</span>
                  <span>50%</span>
                  <span>75%</span>
                  <span>100%</span>
                </div>
                
                {/* Pixel depth chart - blocky stacked squares with hover info */}
                <div className="relative h-32 flex items-end gap-[2px] bg-slate-950 rounded-lg p-2">
                  {[...Array(80)].map((_, col) => {
                    const price = (col + 1) * 1.25; // ~1.25% per column
                    const midPrice = currentProb * 100;
                    const distFromMid = Math.abs(price - midPrice);
                    
                    // Mock liquidity - more detail near mid
                    const baseLiquidity = Math.max(0, 1 - distFromMid / 25);
                    const noise = (Math.sin(col * 0.6) + 1) * 0.25;
                    const liquidity = Math.min(1, Math.max(0.05, baseLiquidity * (0.4 + noise)));
                    
                    // Mock order size (more realistic near mid)
                    const orderSize = Math.round(liquidity * 5000 + Math.random() * 2000);
                    const orderCount = Math.ceil(liquidity * 8);
                    
                    // Number of blocks (max 12)
                    const blocks = Math.ceil(liquidity * 12);
                    
                    const isYesSide = price < midPrice;
                    const isMid = distFromMid < 2;
                    const isNearMid = distFromMid < 10; // Show detailed hover near spread
                    
                    return (
                      <div 
                        key={col} 
                        className={cn(
                          "flex-1 flex flex-col-reverse gap-[2px] relative group",
                          isNearMid && "cursor-pointer"
                        )}
                      >
                        {/* Hover tooltip - only near mid */}
                        {isNearMid && (
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity z-30 pointer-events-none">
                            <div className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-[10px] whitespace-nowrap shadow-xl">
                              <div className="font-mono font-bold text-white">{price.toFixed(1)}%</div>
                              <div className="text-slate-400">
                                {isYesSide ? 'Bid' : 'Ask'}: <span className={isYesSide ? 'text-emerald-400' : 'text-rose-400'}>{orderSize.toLocaleString()}</span>
                              </div>
                              <div className="text-slate-500">{orderCount} orders</div>
                            </div>
                            {/* Arrow */}
                            <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-700" />
                          </div>
                        )}
                        
                        {/* Blocks */}
                        {[...Array(blocks)].map((_, blockIdx) => {
                          const intensity = 1 - (blockIdx / blocks);
                          let blockColor = 'bg-slate-800';
                          
                          if (isMid) {
                            blockColor = intensity > 0.6 ? 'bg-amber-400' : intensity > 0.3 ? 'bg-amber-500' : 'bg-amber-700';
                          } else if (isYesSide) {
                            blockColor = intensity > 0.6 ? 'bg-emerald-400' : intensity > 0.3 ? 'bg-emerald-500' : 'bg-emerald-700';
                          } else {
                            blockColor = intensity > 0.6 ? 'bg-rose-400' : intensity > 0.3 ? 'bg-rose-500' : 'bg-rose-700';
                          }
                          
                          return (
                            <div 
                              key={blockIdx} 
                              className={cn(
                                "w-full aspect-square rounded-[1px] transition-all",
                                blockColor,
                                isNearMid && "group-hover:ring-1 group-hover:ring-white/30"
                              )}
                            />
                          );
                        })}
                      </div>
                    );
                  })}
                  
                  {/* Current price indicator */}
                  <div 
                    className="absolute top-0 bottom-0 w-[3px] bg-white rounded-full shadow-[0_0_10px_3px_rgba(255,255,255,0.7)]"
                    style={{ left: `calc(${currentProb * 100}% - 1px)` }}
                  />
                </div>
                
                {/* Intensity legend */}
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-4 text-[9px] text-slate-500">
                    <div className="flex items-center gap-1">
                      <div className="w-8 h-2 rounded-sm bg-gradient-to-r from-emerald-700 to-emerald-400" />
                      <span>Bid Depth</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-8 h-2 rounded-sm bg-gradient-to-r from-rose-700 to-rose-400" />
                      <span>Ask Depth</span>
                    </div>
                  </div>
                  <div className="text-[9px] text-slate-600">Height = Liquidity at price</div>
                </div>
              </div>
              
              {/* Stats Row */}
              <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800/50">
                <div className="text-center p-2 rounded-lg bg-slate-950">
                  <div className="text-[9px] text-slate-500 uppercase">Best Bid</div>
                  <div className="text-sm font-mono font-bold text-emerald-400">{((currentProb - 0.01) * 100).toFixed(1)}%</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-slate-950">
                  <div className="text-[9px] text-slate-500 uppercase">Best Ask</div>
                  <div className="text-sm font-mono font-bold text-rose-400">{((currentProb + 0.01) * 100).toFixed(1)}%</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-slate-950">
                  <div className="text-[9px] text-slate-500 uppercase">Spread</div>
                  <div className="text-sm font-mono font-bold text-amber-400">2.0%</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-slate-950">
                  <div className="text-[9px] text-slate-500 uppercase">Total Liq</div>
                  <div className="text-sm font-mono font-bold text-white">$12.4K</div>
                </div>
              </div>
            </div>
          </div>

          {/* Your Positions */}
          <div className="rounded-2xl bg-gradient-to-b from-slate-900/80 to-slate-950/80 border border-slate-800/50 p-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Your Positions</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-900/30">
                <div className="text-[10px] text-emerald-500 uppercase mb-1">YES Shares</div>
                <div className="text-2xl font-mono font-bold text-white">
                  {parseFloat(formatUnits(vault?.yesInternal ?? 0n, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-900/30">
                <div className="text-[10px] text-rose-500 uppercase mb-1">NO Shares</div>
                <div className="text-2xl font-mono font-bold text-white">
                  {parseFloat(formatUnits(vault?.noInternal ?? 0n, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>
          </div>
        </div>

          {/* RIGHT: Trading Panel */}
          <div className="lg:col-span-1">
            <div className="rounded-2xl bg-gradient-to-b from-slate-900/80 to-slate-950/80 border border-slate-800/50 overflow-hidden sticky top-4">
              {/* Primary Toggle: YES / NO - subtle underline style */}
              <div className="flex border-b border-slate-800">
                <button
                  onClick={() => setAction(isBuying ? 'buy_yes' : 'sell_yes')}
                  className={cn(
                    "flex-1 py-3 font-bold text-sm uppercase tracking-wider transition-all",
                    isYes 
                      ? "text-emerald-400 border-b-2 border-emerald-500 bg-emerald-500/5" 
                      : "text-slate-500 hover:text-slate-300 border-b-2 border-transparent"
                  )}
                >
                  YES
                </button>
                <button
                  onClick={() => setAction(isBuying ? 'buy_no' : 'sell_no')}
                  className={cn(
                    "flex-1 py-3 font-bold text-sm uppercase tracking-wider transition-all",
                    !isYes 
                      ? "text-rose-400 border-b-2 border-rose-500 bg-rose-500/5" 
                      : "text-slate-500 hover:text-slate-300 border-b-2 border-transparent"
                  )}
                >
                  NO
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Secondary: BUY/SELL + LIMIT/MARKET */}
                <div className="flex gap-2">
                  {/* Buy/Sell Toggle - contextual colors */}
                  <div className="flex-1 flex gap-1 p-1 bg-slate-950 rounded-lg">
                    <button
                      onClick={() => setAction(isYes ? 'buy_yes' : 'buy_no')}
                      className={cn(
                        "flex-1 py-2 rounded-md font-bold text-xs uppercase transition-all",
                        isBuying 
                          ? isYes 
                            ? "bg-emerald-600/30 text-emerald-400 ring-1 ring-emerald-500/50" 
                            : "bg-rose-600/30 text-rose-400 ring-1 ring-rose-500/50"
                          : "text-slate-500 hover:text-slate-300"
                      )}
                    >
                      Buy
                    </button>
                    <button
                      onClick={() => setAction(isYes ? 'sell_yes' : 'sell_no')}
                      className={cn(
                        "flex-1 py-2 rounded-md font-bold text-xs uppercase transition-all",
                        !isBuying 
                          ? "bg-amber-600/30 text-amber-400 ring-1 ring-amber-500/50" 
                          : "text-slate-500 hover:text-slate-300"
                      )}
                    >
                      Sell
                    </button>
                  </div>
                  
                  {/* Limit/Market Toggle - neutral styling */}
                  <div className="flex gap-1 p-1 bg-slate-950 rounded-lg">
                    <button
                      onClick={() => setOrderType('limit')}
                      className={cn(
                        "px-3 py-2 rounded-md font-bold text-xs uppercase transition-all",
                        orderType === 'limit' 
                          ? "bg-slate-700 text-white" 
                          : "text-slate-500 hover:text-slate-300"
                      )}
                    >
                      Limit
                    </button>
                    <button
                      onClick={() => setOrderType('market')}
                      className={cn(
                        "px-3 py-2 rounded-md font-bold text-xs uppercase transition-all",
                        orderType === 'market' 
                          ? "bg-slate-700 text-white" 
                          : "text-slate-500 hover:text-slate-300"
                      )}
                    >
                      Market
                    </button>
                  </div>
                </div>

              {/* Price Input (Limit only) */}
              {orderType === 'limit' && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] text-slate-500 uppercase tracking-wider">Prob</label>
                    <span className="text-[9px] text-slate-600 font-mono">0.1 – 99.9</span>
                  </div>
                  
                  {/* Price input - 0.1% tick precision, min 0.1%, max 99.9% */}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        value={priceLow}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPriceLow(val);
                          if (priceMode === 'single') setPriceHigh(val);
                        }}
                        onBlur={(e) => {
                          // Snap to 0.1% increments, clamp to valid range
                          const snapped = Math.max(0.1, Math.min(99.9, Math.round(parseFloat(e.target.value || '50') * 10) / 10));
                          setPriceLow(snapped.toFixed(1));
                          if (priceMode === 'single') setPriceHigh(snapped.toFixed(1));
                        }}
                        placeholder={priceMode === 'single' ? 'Price' : 'Low'}
                        className={cn(
                          "w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-lg font-mono font-bold focus:outline-none transition-colors",
                          isYes ? "focus:border-emerald-500" : "focus:border-rose-500"
                        )}
                        min="0.1"
                        max="99.9"
                        step="0.1"
                      />
                    </div>
                    
                    {priceMode === 'range' && (
                      <>
                        <span className="self-center text-slate-600">–</span>
                        <div className="relative flex-1">
                          <input
                            type="number"
                            value={priceHigh}
                            onChange={(e) => setPriceHigh(e.target.value)}
                            onBlur={(e) => {
                              // Snap to 0.1% increments, clamp to valid range, ensure > priceLow
                              const snapped = Math.max(priceLowNum + 0.1, Math.min(99.9, Math.round(parseFloat(e.target.value || '50') * 10) / 10));
                              setPriceHigh(snapped.toFixed(1));
                            }}
                            placeholder="High"
                            className={cn(
                              "w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-lg font-mono font-bold focus:outline-none transition-colors",
                              isYes ? "focus:border-emerald-500" : "focus:border-rose-500"
                            )}
                            min="0.1"
                            max="99.9"
                            step="0.1"
                          />
                        </div>
                      </>
                    )}
                    
                    {/* Range toggle button - contextual colors */}
                    <button
                      onClick={() => {
                        if (priceMode === 'single') {
                          setPriceMode('range');
                          setPriceHigh(Math.min(99.9, priceLowNum + 10).toFixed(1));
                        } else {
                          setPriceMode('single');
                          setPriceHigh(priceLow);
                        }
                      }}
                      className={cn(
                        "px-3 py-2 rounded-lg text-[10px] font-bold uppercase transition-all border",
                        priceMode === 'range' 
                          ? isYes 
                            ? "bg-emerald-600/20 text-emerald-400 border-emerald-600/50" 
                            : "bg-rose-600/20 text-rose-400 border-rose-600/50"
                          : "bg-slate-900 text-slate-500 border-slate-700 hover:text-white hover:border-slate-600"
                      )}
                    >
                      {priceMode === 'single' ? '± Range' : 'Single'}
                    </button>
                  </div>
                  
                  {/* Slider - available in both single and range modes */}
                  <div className="space-y-1">
                    <div className="relative h-10 flex items-center px-1">
                      {/* Track background */}
                      <div className="absolute inset-x-1 h-2 bg-slate-800 rounded-full" />
                      
                      {/* Active range/point highlight */}
                      <div 
                        className={cn(
                          "absolute h-2 rounded-full pointer-events-none",
                          isYes ? "bg-gradient-to-r from-emerald-600 to-emerald-400" : "bg-gradient-to-r from-rose-600 to-rose-400"
                        )}
                        style={priceMode === 'single' 
                          ? { left: '0.1%', width: `${priceLowNum}%` }
                          : { left: `${priceLowNum}%`, width: `${Math.max(0.1, priceHighNum - priceLowNum)}%` }
                        }
                      />
                      
                      {/* Single mode slider */}
                      {priceMode === 'single' && (
                        <input
                          type="range"
                          min="0.1"
                          max="99.9"
                          step="0.1"
                          value={priceLowNum}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setPriceLow(val.toFixed(1));
                            setPriceHigh(val.toFixed(1));
                          }}
                          className="absolute w-full h-8 opacity-0 cursor-pointer z-20"
                        />
                      )}
                      
                      {/* Range mode: Low thumb slider (left half priority) */}
                      {priceMode === 'range' && (
                        <input
                          type="range"
                          min="0.1"
                          max="99.9"
                          step="0.1"
                          value={priceLowNum}
                          onChange={(e) => {
                            const val = Math.min(Number(e.target.value), priceHighNum - 0.1);
                            setPriceLow(val.toFixed(1));
                          }}
                          className="absolute h-8 opacity-0 cursor-pointer z-20"
                          style={{ left: 0, width: `${(priceLowNum + priceHighNum) / 2}%` }}
                        />
                      )}
                      
                      {/* Range mode: High thumb slider (right half priority) */}
                      {priceMode === 'range' && (
                        <input
                          type="range"
                          min="0.1"
                          max="99.9"
                          step="0.1"
                          value={priceHighNum}
                          onChange={(e) => {
                            const val = Math.max(Number(e.target.value), priceLowNum + 0.1);
                            setPriceHigh(val.toFixed(1));
                          }}
                          className="absolute h-8 opacity-0 cursor-pointer z-20"
                          style={{ left: `${(priceLowNum + priceHighNum) / 2}%`, width: `${100 - (priceLowNum + priceHighNum) / 2}%` }}
                        />
                      )}
                      
                      {/* Thumb(s) - visual only */}
                      {/* Low thumb: circle */}
                      <div 
                        className={cn(
                          "absolute w-5 h-5 rounded-full border-2 border-white shadow-lg pointer-events-none z-10",
                          isYes ? "bg-emerald-500" : "bg-rose-500"
                        )} 
                        style={{ left: `calc(${priceLowNum}% - 10px)` }} 
                      />
                      {/* High thumb: diamond shape */}
                      {priceMode === 'range' && (
                        <div 
                          className={cn(
                            "absolute w-4 h-4 border-2 border-white shadow-lg pointer-events-none z-10 rotate-45",
                            isYes ? "bg-emerald-300" : "bg-rose-300"
                          )} 
                          style={{ left: `calc(${priceHighNum}% - 8px)`, top: '50%', marginTop: '-8px' }} 
                        />
                      )}
                    </div>
                    
                    {/* Tick count indicator */}
                    <div className="text-center text-[9px] text-slate-500">
                      {priceMode === 'single' 
                        ? <span>Tick <span className={cn("font-bold", isYes ? "text-emerald-400" : "text-rose-400")}>{Math.round(priceLowNum * 10)}</span></span>
                        : <span><span className={cn("font-bold", isYes ? "text-emerald-400" : "text-rose-400")}>{numTicks}</span> ticks</span>
                      }
                    </div>
                  </div>

                  {/* Quick presets - 0.1 precision */}
                  <div className="flex gap-1.5">
                    {(priceMode === 'single' 
                      ? [[25.0], [50.0], [75.0]] 
                      : [[40.0, 60.0], [45.0, 55.0], [48.0, 52.0]]
                    ).map((p, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setPriceLow(p[0].toFixed(1));
                          setPriceHigh((p[1] ?? p[0]).toFixed(1));
                        }}
                        className="flex-1 py-1.5 text-[10px] font-mono text-slate-500 hover:text-white bg-slate-900 hover:bg-slate-800 rounded transition-colors"
                      >
                        {p.length > 1 ? `${p[0]}–${p[1]}` : p[0]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Amount Input */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider">Amount (Shares)</label>
                  <span className="text-[10px] text-slate-600 font-mono">
                    Max: {parseFloat(formatUnits(vaultAvailable, 18)).toLocaleString()}
                  </span>
                </div>
                <input
                  type="number"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-xl font-mono font-bold focus:border-amber-500 focus:outline-none"
                />
                {/* Quick amount buttons */}
                <div className="flex gap-2 mt-2">
                  {[100, 500, 1000].map(a => (
                    <button
                      key={a}
                      onClick={() => setAmount(a.toString())}
                      className="flex-1 py-1 text-xs font-mono text-slate-500 hover:text-white bg-slate-900 hover:bg-slate-800 rounded transition-colors"
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              {/* Order Summary */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                {orderType === 'limit' && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">
                      {priceMode === 'single' ? 'Prob' : 'Prob Range'}
                    </span>
                    <span className="font-mono text-amber-400">
                      {priceMode === 'single' 
                        ? priceLowNum.toFixed(1)
                        : `${priceLowNum.toFixed(1)} – ${priceHighNum.toFixed(1)}`}
                    </span>
                  </div>
                )}
                {orderType === 'limit' && priceMode === 'range' && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Shares/Tick</span>
                    <span className="font-mono text-slate-300">
                      {amountNum > 0 ? (amountNum / numTicks).toFixed(2) : '–'}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">{isBuying ? 'Est. Cost' : 'Est. Return'}</span>
                  <span className={cn("font-mono", isBuying ? "text-white" : "text-emerald-400")}>
                    {amountNum > 0 
                      ? `${isBuying ? '-' : '+'}$${estimatedValue.toFixed(2)}`
                      : '–'
                    }
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">
                    {isBuying ? 'Available USDC' : `Your ${isYes ? 'YES' : 'NO'} Shares`}
                  </span>
                  <span className={cn("font-mono", hasEnoughBalance ? "text-emerald-400" : "text-rose-400")}>
                    {isBuying 
                      ? `$${parseFloat(formatUnits(vaultAvailable, 18)).toFixed(2)}`
                      : parseFloat(formatUnits(isYes ? (vault?.yesInternal ?? 0n) : (vault?.noInternal ?? 0n), 18)).toLocaleString(undefined, { maximumFractionDigits: 0 })
                    }
                  </span>
                </div>
              </div>

              {/* Insufficient Balance Warning */}
              {amount && isBuying && !hasEnoughBalance && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-950/30 border border-rose-900/30 text-rose-400 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Insufficient vault balance. <button onClick={() => setShowVaultPanel(true)} className="underline">Deposit more</button></span>
                </div>
              )}
              
              {/* Insufficient Shares Warning (for sells) */}
              {amount && !isBuying && (() => {
                const shares = isYes ? (vault?.yesInternal ?? 0n) : (vault?.noInternal ?? 0n);
                const needed = parseUnits(amount, 18);
                return shares < needed;
              })() && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-950/30 border border-rose-900/30 text-rose-400 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Not enough {isYes ? 'YES' : 'NO'} shares to sell.</span>
                </div>
              )}

              {/* Execute Button */}
              <Button
                onClick={handleTrade}
                disabled={!isConnected || !amount || isSubmitting || !tickBook?.isActive || (isBuying && !hasEnoughBalance)}
                className={cn(
                  "w-full py-4 text-lg font-bold uppercase tracking-wider rounded-xl transition-all",
                  action === 'buy_yes' && "bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 shadow-lg shadow-emerald-600/25",
                  action === 'buy_no' && "bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 shadow-lg shadow-rose-600/25",
                  (action === 'sell_yes' || action === 'sell_no') && "bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 shadow-lg shadow-amber-600/25",
                  (!isConnected || !amount || isSubmitting || (isBuying && !hasEnoughBalance)) && "opacity-50 cursor-not-allowed"
                )}
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                ) : !isConnected ? (
                  'Connect Wallet'
                ) : (
                  `${action.replace('_', ' ').toUpperCase()} ${amount || '0'}`
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pro;
