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
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Zap, Wallet, ArrowUpRight, ArrowDownRight, RefreshCw, AlertCircle, Loader2, ArrowLeft, BookOpen, TrendingUp, ChevronLeft, ChevronRight, ExternalLink, Package, ArrowLeftRight, TrendingDown, BarChart3, Calendar, User, Shield, Trophy, XCircle, CheckCircle, Clock
} from 'lucide-react';
import { useAccount, useChainId, useWriteContract, useReadContract, usePublicClient } from 'wagmi';
import { logger } from '../lib/logger';
import { parseUnits, formatUnits } from 'viem';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Tooltip } from '../components/ui/Tooltip';
import { MarketHeader } from '../components/features/MarketHeader';
import { MarketDetailHeader } from '../components/features/launchpad/MarketDetailHeader';
import { GraduationProgress } from '../components/features/launchpad/GraduationProgress';
import {
  useLaunchpadMarketDirect,
  useTruthMarketDirect,
  useCollateralizerDirect,
  useTickBookDirect,
  useTickBookQuoteDirect,
  useTickBookVaultDirect,
  useTokenBalances,
  useAmmMarketDirect,
  useInvalidateQueries,
  usePlaceOrder,
  useOnChainMarkets,
  RangeOrder
} from '../hooks';
import { usePendingRefunds } from '../hooks/usePendingRefunds';
import { useOrdersIndexed, useOrderbookIndexed, useSpotSellsIndexed, type SpotSellOrderIndexed } from '../hooks/indexer';
import { useDeployments } from '../hooks/useDeployments';
import { ABIS } from '../config/abis';
import marketsConfig from '../config/markets.json';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';
import { useChainStore } from '../store/useChainStore';
import { LiquidityMap, UserOrdersPanel } from '../components/features/pro';

interface StaticMarket {
  id: string;
  contractAddress: string;
  name: string;
  symbol: string;
  description?: string;
  category?: string;
  imageUrl?: string | null;
  version?: string;
  chainId?: number;
}
const staticMarkets = (marketsConfig.markets || []) as StaticMarket[];

type OrderAction = 'buy_yes' | 'sell_yes' | 'buy_no' | 'sell_no';
type OrderType = 'limit' | 'market';

const MARKET_ORDER_ENABLED = false;

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'sports', label: 'Sports' },
  { id: 'cultures', label: 'Cultures' },
  { id: 'others', label: 'Others' },
];

// Stages for Pro - graduated markets (live, settled, finalized) can manage TickBook positions
const STAGES = [
  { id: 'all', label: 'All' },
  { id: 'live', label: 'Live' },
  { id: 'settled', label: 'Settled' },
  { id: 'finalized', label: 'Finalized' },
];

// ============================================================================
// Main Component
// ============================================================================
export const Pro = () => {
  const { marketId } = useParams<{ marketId?: string }>();
  const navigate = useNavigate();
  const { selectedChainId } = useChainStore();
  const chainId = typeof selectedChainId === 'number' ? selectedChainId : Number(selectedChainId);
  const previousChainId = useRef<number | null>(null);

  useEffect(() => {
    if (previousChainId.current !== null && previousChainId.current !== chainId && marketId) {
      navigate('/pro');
    }
    previousChainId.current = chainId;
  }, [chainId, marketId, navigate]);

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
  const [stage, setStage] = useState('all');
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // V9.9.6: On-chain market discovery - only show graduated markets
  const { markets: onChainMarkets, isLoading: isLoadingMarkets } = useOnChainMarkets();

  // Filter to graduated markets for Pro trading (includes settled/finalized for position management)
  const allMarkets = useMemo(() => {
    // Show graduated markets (live, settled, finalized) - exclude only dismissed
    const eligibleMarkets = onChainMarkets.filter(m =>
      m.isGraduated && !m.isDismissed
    );

    return eligibleMarkets.map(m => {
      const staticMarket = staticMarkets.find(
        s => s.contractAddress.toLowerCase() === m.address.toLowerCase()
      );

      let localMeta: { category?: string; name?: string } | null = null;
      try {
        const stored = localStorage.getItem(`market_meta_${m.address.toLowerCase()}`);
        if (stored) localMeta = JSON.parse(stored);
      } catch { /* ignore */ }

      return {
        contractAddress: m.address,
        name: staticMarket?.name || localMeta?.name || m.name || 'Unknown Market',
        symbol: staticMarket?.symbol || m.symbol || '???',
        category: (staticMarket as any)?.category || localMeta?.category || 'others',
        description: staticMarket?.description,
        imageUrl: staticMarket?.imageUrl,
        isGraduated: m.isGraduated,
        isSettled: m.isSettled,
        isDismissed: m.isDismissed,
        stage: m.stage,
        creator: m.creator,
        createdAt: m.createdAt,
      };
    });
  }, [onChainMarkets]);

  // Filter by search, category, and stage
  const filteredMarkets = useMemo(() => {
    return allMarkets.filter(m => {
      const matchesSearch = !search ||
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.symbol.toLowerCase().includes(search.toLowerCase());

      const matchesCategory = category === 'all' ||
        m.category?.toLowerCase() === category.toLowerCase();

      const matchesStage = stage === 'all' || m.stage === stage;

      return matchesSearch && matchesCategory && matchesStage;
    });
  }, [allMarkets, search, category, stage]);

  // Generate category counts
  const categoriesWithCounts = useMemo(() => {
    return CATEGORIES.map(cat => ({
      ...cat,
      count: cat.id === 'all'
        ? allMarkets.length
        : allMarkets.filter(m => m.category?.toLowerCase() === cat.id).length
    }));
  }, [allMarkets]);

  // Generate stage counts
  const stagesWithCounts = useMemo(() => {
    return STAGES.map(s => ({
      ...s,
      count: s.id === 'all'
        ? allMarkets.length
        : allMarkets.filter(m => m.stage === s.id).length
    }));
  }, [allMarkets]);

  const totalMarketCount = filteredMarkets.length;

  useEffect(() => {
    setSelectedMarketId(null);
  }, [chainId]);

  React.useEffect(() => {
    if (!selectedMarketId && filteredMarkets.length > 0) {
      setSelectedMarketId(filteredMarkets[0].contractAddress);
    }
  }, [filteredMarkets, selectedMarketId]);

  React.useEffect(() => {
    if (selectedMarketId && !filteredMarkets.some(m => m.contractAddress === selectedMarketId)) {
      setSelectedMarketId(null);
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

  const selectedMarket = filteredMarkets.find(m => m.contractAddress === selectedMarketId) ||
    filteredMarkets[0];

  return (
    <div className="space-y-6">
      <MarketHeader
        title="Pro Trading on TickBook"
        hint="TickBook is an on-chain orderbook with 10,000 price ticks (0.01% to 99.99%). Place limit orders or provide concentrated liquidity across price ranges. Makers earn from taker fills with no fees. Available only for graduated markets."
        search={search}
        onSearchChange={setSearch}
        category={category}
        onCategoryChange={setCategory}
        categories={categoriesWithCounts}
        stage={stage}
        onStageChange={setStage}
        stages={stagesWithCounts}
        marketCount={totalMarketCount}
      />

      {/* Horizontal Market Scroll */}
      {isLoadingMarkets ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
          <span className="ml-2 text-slate-400">Discovering markets...</span>
        </div>
      ) : filteredMarkets.length === 0 ? (
        <EmptyState search={search} />
      ) : (
        <GraduatedMarketsScroll
          markets={filteredMarkets}
          selectedMarketId={selectedMarketId}
          onSelect={handleMarketSelect}
          scrollRef={scrollRef}
          onScroll={scroll}
        />
      )}

      {/* Trading Terminal for selected market */}
      {selectedMarket && (
        <ProTradingTerminal marketId={selectedMarket.contractAddress} embedded />
      )}
    </div>
  );
};

// ============================================================================
// Graduated Markets Scroll - Shows graduated markets from on-chain discovery
// ============================================================================
interface GraduatedMarketsScrollProps {
  markets: Array<{
    contractAddress: string;
    name: string;
    symbol: string;
    category?: string;
    stage?: 'bonding' | 'live' | 'settled' | 'finalized' | 'dismissed';
  }>;
  selectedMarketId: string | null;
  onSelect: (market: any) => void;
  scrollRef: React.RefObject<HTMLDivElement>;
  onScroll: (direction: 'left' | 'right') => void;
}

const GraduatedMarketsScroll = ({ markets, selectedMarketId, onSelect, scrollRef, onScroll }: GraduatedMarketsScrollProps) => {
  // No need for graduation tracking - markets are already filtered to graduated only
  if (markets.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p className="text-sm">No graduated markets found</p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {/* Left scroll button */}
      <button
        onClick={() => onScroll('left')}
        className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-900/90 border border-slate-700 flex items-center justify-center hover:bg-slate-800 hover:border-slate-600 transition-colors"
      >
        <ChevronLeft className="w-5 h-5 text-slate-400" />
      </button>

      {/* Scrollable container */}
      <div
        ref={scrollRef}
        className="flex-1 flex gap-3 overflow-x-auto scrollbar-hide py-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {markets.map(market => (
          <ProMarketChip
            key={market.contractAddress}
            market={market}
            isSelected={market.contractAddress === selectedMarketId}
            onClick={() => onSelect(market)}
          />
        ))}
      </div>

      {/* Right scroll button */}
      <button
        onClick={() => onScroll('right')}
        className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-900/90 border border-slate-700 flex items-center justify-center hover:bg-slate-800 hover:border-slate-600 transition-colors"
      >
        <ChevronRight className="w-5 h-5 text-slate-400" />
      </button>
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
    stage?: 'bonding' | 'live' | 'settled' | 'finalized' | 'dismissed';
  };
  isSelected: boolean;
  onClick: () => void;
}

const ProMarketChip = ({ market, isSelected, onClick }: ProMarketChipProps) => {
  const getStageDisplay = () => {
    switch (market.stage) {
      case 'dismissed':
        return (
          <div className="flex items-center gap-1.5 text-xs text-rose-400">
            <XCircle className="w-3 h-3" />
            <span>Dismissed</span>
          </div>
        );
      case 'finalized':
        return (
          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
            <Trophy className="w-3 h-3" />
            <span>Finalized</span>
          </div>
        );
      case 'settled':
        return (
          <div className="flex items-center gap-1.5 text-xs text-amber-400">
            <Trophy className="w-3 h-3" />
            <span>Settled</span>
          </div>
        );
      case 'live':
      default:
        return (
          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
            <BarChart3 className="w-3 h-3" />
            <span>Graduated</span>
          </div>
        );
    }
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-shrink-0 flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all w-[320px]",
        isSelected
          ? "bg-slate-500/10 border-slate-500/50 shadow-lg shadow-slate-500/10"
          : "bg-slate-900/80 border-slate-800 hover:border-slate-700"
      )}
    >
      <div className="text-left min-w-0 flex-1">
        <div className="text-xs text-white font-medium line-clamp-2 leading-tight">{market.name}</div>
      </div>

      {getStageDisplay()}
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
  const graduationProgress = launchpad?.graduationProgress ?? 0;

  return (
    <button
      onClick={onClick}
      disabled={!isGraduated && !isLoading}
      className={cn(
        "w-full p-4 rounded-xl border text-left transition-all",
        isGraduated
          ? "bg-slate-900/80 border-slate-800 hover:border-slate-600 cursor-pointer"
          : "bg-slate-900/30 border-slate-800/30 cursor-not-allowed opacity-60"
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-sm text-white font-medium line-clamp-2">{market.name}</div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isLoading ? (
            <span className="text-xs text-slate-500">...</span>
          ) : isGraduated ? (
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-xs font-medium">
              Graduated
            </span>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-cyan-400">
              <Zap className="w-3 h-3" />
              <span className="font-mono">{graduationProgress.toFixed(0)}%</span>
            </div>
          )}
        </div>
      </div>
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
    <Link to="/v8" className="text-slate-400 hover:text-slate-300 text-sm font-medium">
      Browse AMM Markets →
    </Link>
  </div>
);

// ============================================================================
// Trading Terminal
// ============================================================================
// Helper: Get block explorer URL
const getExplorerUrl = (chainId: number, txHash: string) => {
  const explorers: Record<number, string> = {
    84532: 'https://sepolia.basescan.org',
    8453: 'https://basescan.org',
    10143: 'https://testnet.monadvision.com',
    5042002: 'https://testnet.arcscan.app',
  };
  return `${explorers[chainId] || 'https://sepolia.basescan.org'}/tx/${txHash}`;
};

// Helper: Get address explorer URL
const getAddressExplorerUrl = (chainId: number, address: string) => {
  const explorers: Record<number, string> = {
    84532: 'https://sepolia.basescan.org',
    8453: 'https://basescan.org',
    10143: 'https://testnet.monadvision.com',
    5042002: 'https://testnet.arcscan.app',
  };
  return `${explorers[chainId] || 'https://sepolia.basescan.org'}/address/${address}`;
};

const ProTradingTerminal = ({ marketId, embedded = false }: { marketId: string; embedded?: boolean }) => {
  const navigate = useNavigate();
  const { isConnected, address: userAddress } = useAccount();
  const chainId = useChainId();
  const { contracts } = useDeployments();
  const { writeContractAsync } = useWriteContract(); // For approve, deposit, withdraw
  const publicClient = usePublicClient();

  // UI State
  const [action, setAction] = useState<OrderAction>('buy_yes');
  const [orderType, setOrderType] = useState<OrderType>('limit');
  const [priceMode, setPriceMode] = useState<'single' | 'range'>('range');
  const [priceLow, setPriceLow] = useState('45.0');
  const [priceHigh, setPriceHigh] = useState('55.0');
  const [amount, setAmount] = useState('1');
  const [useFloorPrice, setUseFloorPrice] = useState(false); // Toggle for floor price
  const [floorPrice, setFloorPrice] = useState('50'); // Default floor value when enabled
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [vaultInput, setVaultInput] = useState('');
  const [marketKeyCopied, setMarketKeyCopied] = useState(false);

  useEffect(() => {
    if (!MARKET_ORDER_ENABLED && orderType === 'market') {
      setOrderType('limit');
    }
  }, [orderType, setOrderType]);

  // Slider dragging state
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [isLowDragging, setIsLowDragging] = React.useState(false);
  const [isHighDragging, setIsHighDragging] = React.useState(false);

  // Data - use marketId directly as address, look up static config only for UI metadata
  const { staticMetadata } = useMemo(() => {
    const markets = staticMarkets.filter(m => m.version?.startsWith('v') && m.chainId === chainId);
    const found = markets.find(m =>
      m.contractAddress.toLowerCase() === marketId.toLowerCase() ||
      m.id.toLowerCase() === marketId.toLowerCase()
    );
    return {
      staticMetadata: found, // Optional UI metadata (name, symbol, category, etc)
    };
  }, [marketId, chainId]);

   // CRITICAL: Use marketId directly as the address - don't require it to be in static config
   const marketAddr = marketId as `0x${string}`;
   const invalidateV8Queries = useInvalidateQueries();

   // Get market stage from on-chain discovery for fallback settlement UI gating
   const { markets: onChainMarkets } = useOnChainMarkets();
   const currentMarketStage = useMemo(() => {
     return onChainMarkets.find(m => m.address.toLowerCase() === marketAddr.toLowerCase())?.stage;
   }, [onChainMarkets, marketAddr]);

   const { launchpad, isLoading: isLoadingLaunchpad } = useLaunchpadMarketDirect(marketAddr);
   const { market: truth } = useTruthMarketDirect(marketAddr);
  const { collateralizer, isLoading: isCollateralizerLoading } = useCollateralizerDirect(marketAddr);
  const { amm } = useAmmMarketDirect(marketAddr);
  const { tickBook, isLoading: isTickBookLoading } = useTickBookDirect(
    marketAddr,
    collateralizer?.yesToken,
    collateralizer?.noToken
  );
  const { vault } = useTickBookVaultDirect(userAddress, marketAddr);

  // V9.9.6 Unified Order API
  const {
    marketOrder,
    marketWithFloor,
    rangeOrder,
    limitOrder,
    placeSpotSell,
    cancelSpotSell,
    isPending: isOrderPending,
    calculateMaxCost,
  } = usePlaceOrder(tickBook?.marketKey as `0x${string}`);

  // Fetch user's orders (indexer with RPC fallback)
  const { orders: userOrders, isLoading: isOrdersLoading, source: ordersSource } = useOrdersIndexed(
    tickBook?.marketKey as `0x${string}`,
    userAddress
  );

  // Fetch orderbook data (indexer with RPC fallback)
  const { orders: allOrders, orderbook, isLoading: isAllOrdersLoading, source: orderbookSource } = useOrderbookIndexed(
    tickBook?.marketKey as `0x${string}`
  );

  const { spotSells, isLoading: isSpotSellsLoading } = useSpotSellsIndexed(
    tickBook?.marketKey as `0x${string}`
  );

  const { pendingRefundsWad } = usePendingRefunds(
    userAddress,
    tickBook?.marketKey as `0x${string}`
  );

  const { balances } = useTokenBalances(useMemo(() => [
    contracts.MockUSDC as `0x${string}`
  ].filter(Boolean) as `0x${string}`[], [contracts.MockUSDC]));

  const { data: usdcDecimals } = useReadContract({
    address: contracts.MockUSDC as `0x${string}`,
    abi: ABIS.OutcomeToken,
    functionName: 'decimals',
    query: { enabled: !!contracts.MockUSDC, staleTime: Infinity },
  });
  const decimals = Number(usdcDecimals ?? 18);

  const walletUsdc = balances[0] ?? 0n;
  const vaultAvailable = vault?.availableUsdcWad ?? 0n;
  const vaultReserved = vault?.reservedUsdcWad ?? 0n;

  // Approval check
  const { data: vaultAllowance } = useReadContract({
    address: contracts.MockUSDC as `0x${string}`,
    abi: ABIS.OutcomeToken,
    functionName: 'allowance',
    args: isConnected && contracts.TickBookVault ? [userAddress!, contracts.TickBookVault as `0x${string}`] : undefined,
    query: { enabled: !!isConnected && !!contracts.TickBookVault && !!contracts.MockUSDC }
  });

  // Derived UI State
  const isBuying = action === 'buy_yes' || action === 'buy_no';
  const isYes = action === 'buy_yes' || action === 'sell_yes';

  const { quote: tbQuote, isLoading: isQuoteLoading } = useTickBookQuoteDirect(
    tickBook?.marketKey as `0x${string}`,
    isYes ? 1 : 0,  // YES=1, NO=0 (V8.13.0 unified semantics)
    amount
  );

  // Custom Slider Drag Logic - Integrated within terminal component
  const handlePointerMove = useCallback((e: PointerEvent) => {
    if ((!isLowDragging && !isHighDragging) || !trackRef.current) return;

    const rect = trackRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    let percent = Math.max(0.1, Math.min(99.9, (x / rect.width) * 100));
    percent = Math.round(percent * 10) / 10;

    // Use current numeric values for bounds
    const curLowNum = parseFloat(priceLow);
    const curHighNum = parseFloat(priceHigh);

    if (isLowDragging) {
      if (priceMode === 'single') {
        setPriceLow(percent.toFixed(1));
        setPriceHigh(percent.toFixed(1));
      } else {
        // Drag LOW: Must not exceed current high. Independent movement.
        setPriceLow(Math.min(percent, curHighNum - 0.1).toFixed(1));
      }
    } else if (isHighDragging) {
      // Drag HIGH: Must not go below current low. Independent movement.
      setPriceHigh(Math.max(percent, curLowNum + 0.1).toFixed(1));
    }
  }, [isLowDragging, isHighDragging, priceMode, priceLow, priceHigh]);

  const handlePointerUp = useCallback(() => {
    setIsLowDragging(false);
    setIsHighDragging(false);
  }, []);

  useEffect(() => {
    if (isLowDragging || isHighDragging) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      return () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
      };
    }
  }, [isLowDragging, isHighDragging, handlePointerMove, handlePointerUp]);

  const needsApproval = useMemo(() => {
    return ((vaultAllowance as bigint) ?? 0n) < parseUnits('1000', decimals);
  }, [vaultAllowance, decimals]);

  // Derived values
  // V9.8: currentTick ranges 1-999 (0.1¢ to 99.9¢). Tick 1 means MIN_TICK (no Pro trades yet).
  // Show Pro Price if market is active and we have valid probability data.
  // Note: Tick = 1 means no Pro orderbook trades yet, but market may still be active.
  const currentTick = tickBook?.currentTick ?? 0;
  const rawProb = tickBook?.probability ?? null;
  const isMarketActive = tickBook?.isActive ?? false;
  // Show Pro Price only if market is active, has valid probability, AND trades have occurred (tick > 1)
  // currentTick === 1 means MIN_TICK (no Pro trades yet)
  const isProPriceValid = isMarketActive && rawProb !== null && rawProb > 0 && currentTick > 1;
  const proPriceCents = rawProb !== null ? rawProb * 100 : 0; // probability 0.5 = 50.0¢

  // Debug log for troubleshooting
  if (tickBook) {
    logger.market.log(`Market ${marketAddr} - currentTick: ${currentTick}, probability: ${rawProb}, isActive: ${isMarketActive}, isProPriceValid: ${isProPriceValid}`);
  }
  const rawBookProb = tickBook?.probability ?? null;
  const ammProb = amm?.yesProbability ?? 0.5;
  const ammPriceCents = ammProb * 100;
  const tickBookProb = isProPriceValid ? rawBookProb : null; // null means N/A
  const arbSpread = isProPriceValid ? Math.abs(proPriceCents - ammPriceCents) : 0;
  const hasArb = arbSpread >= 0.5; // Show arb indicator if >= 0.5¢ difference

  // Use tickBook price as primary (or fall back to AMM if no tickBook data)
  const currentProb = tickBookProb ?? ammProb;
  const priceLowNum = parseFloat(priceLow) || 45;
  const priceHighNum = parseFloat(priceHigh) || 55;
  const amountNum = parseFloat(amount) || 0;
  const numTicks = priceMode === 'single' ? 1 : Math.max(1, Math.round((priceHighNum - priceLowNum) * 10) + 1);
  const avgPrice = priceMode === 'single' ? priceLowNum : (priceLowNum + priceHighNum) / 2;

  // V10.4: Spot sell range limited to 50 ticks (5% price range) for gas optimization
  const MAX_SPOT_RANGE = 50;
  // When range is too wide for spot sell, we'll automatically use short sell instead
  const spotRangeExceedsLimit = priceMode === 'range' && numTicks > MAX_SPOT_RANGE;

  // Calculate required collateral based on action

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

  // Determine sell type for display purposes
  // V10.4: If range > 50 ticks, force short sell (can't use spot sell for wide ranges)
  const sellType = useMemo(() => {
    if (isBuying || !amountNum) return null;
    // Wide ranges always use short sell (buying opposite) due to V10.4 gas optimization
    if (spotRangeExceedsLimit) return 'short';
    const shares = isYes ? (vault?.yesInternal ?? 0n) : (vault?.noInternal ?? 0n);
    const needed = parseUnits(amountNum.toFixed(18), 18);
    if (shares >= needed) return 'spot';
    if (shares > 0n && shares < needed) return 'hybrid';
    return 'short';
  }, [isBuying, amountNum, isYes, vault?.yesInternal, vault?.noInternal, spotRangeExceedsLimit]);

  // Handlers - with proper transaction tracking
  const handleApprove = async () => {
    setIsSubmitting(true);
    const toastId = toast.loading('Submitting approval...');
    try {
      const hash = await writeContractAsync({
        address: contracts.MockUSDC as `0x${string}`,
        abi: ABIS.OutcomeToken,
        functionName: 'approve',
        args: [contracts.TickBookVault as `0x${string}`, parseUnits('1000000000', decimals)]
      });

      toast.loading('Waiting for confirmation...', { id: toastId });

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }

      invalidateV8Queries();
      toast.success(
        <div className="flex items-center gap-2">
          <span>Vault approved!</span>
          <a href={getExplorerUrl(chainId, hash)} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-slate-300">
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>,
        { id: toastId }
      );
    } catch (e: any) {
      const msg = e?.cause?.reason || e?.shortMessage || 'Approval failed';
      toast.error(msg, { id: toastId });
      logger.trade.error('Approval failed:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeposit = async () => {
    if (!vaultInput) return;

    // Validate balance before submitting
    const depositWad = parseUnits(vaultInput, decimals);
    if (depositWad > walletUsdc) {
      toast.error(`Insufficient balance. You have $${parseFloat(formatUnits(walletUsdc, decimals)).toLocaleString()} USDC`);
      return;
    }

    setIsSubmitting(true);
    const depositAmt = vaultInput;
    const toastId = toast.loading('Submitting deposit...');
    try {
      const hash = await writeContractAsync({
        address: contracts.TickBookVault as `0x${string}`,
        abi: ABIS.TickBookVaultPoolManager,
        functionName: 'depositUsdc',
        args: [depositWad]
      });

      toast.loading('Waiting for confirmation...', { id: toastId });

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }

      invalidateV8Queries();
      setVaultInput('');
      toast.success(
        <div className="flex items-center gap-2">
          <span>Deposited ${depositAmt}</span>
          <a href={getExplorerUrl(chainId, hash)} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-slate-300">
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>,
        { id: toastId }
      );
    } catch (e: any) {
      const msg = e?.cause?.reason || e?.shortMessage || 'Deposit failed';
      toast.error(msg, { id: toastId });
      logger.trade.error('Deposit failed:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    if (!vaultInput) return;
    setIsSubmitting(true);
    const withdrawAmt = vaultInput;
    const toastId = toast.loading('Submitting withdrawal...');
    try {
      const hash = await writeContractAsync({
        address: contracts.TickBookVault as `0x${string}`,
        abi: ABIS.TickBookVaultPoolManager,
        functionName: 'withdrawUsdc',
        args: [parseUnits(vaultInput, 18)]
      });

      toast.loading('Waiting for confirmation...', { id: toastId });

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }

      invalidateV8Queries();
      setVaultInput('');
      toast.success(
        <div className="flex items-center gap-2">
          <span>Withdrew ${withdrawAmt}</span>
          <a href={getExplorerUrl(chainId, hash)} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-slate-300">
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>,
        { id: toastId }
      );
    } catch (e: any) {
      const msg = e?.cause?.reason || e?.shortMessage || 'Withdrawal failed';
      toast.error(msg, { id: toastId });
      logger.trade.error('Withdrawal failed:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  // V9.9.6: Auto-claim is now built into placeOrder() - no manual call needed

  const handleTrade = async () => {
    if (!amount || !tickBook?.marketKey) return;

    setIsSubmitting(true);
    const amountBg = parseUnits(amount, 18);

    logger.trade.log('handleTrade amount:', amount, 'amountBg:', amountBg.toString(), 'marketKey:', tickBook.marketKey);

    // Determine outcome: outcome=1 credits YES, outcome=0 credits NO
    const outcome = (isYes ? 1 : 0) as 0 | 1;
    const isMarketOrderType = MARKET_ORDER_ENABLED && orderType === 'market';

    if (!MARKET_ORDER_ENABLED && orderType === 'market') {
      toast.error('Market orders are temporarily disabled');
      return;
    }

    try {
      let result: any;

      if (isBuying) {
        // ============= BUY ORDERS =============
        if (isMarketOrderType) {
          // V9.9.6: Use marketOrder or marketWithFloor
          const floorCents = useFloorPrice ? Math.round(parseFloat(floorPrice) * 10) : 0;

          if (floorCents > 0) {
            // Floor price set: input is USDC to spend
            // Pass large shares, let maxCost limit spending
            const maxSharesWad = parseUnits('1000000000', 18); // 1B shares (effectively unlimited)
            const maxCost = amountBg; // User's USDC amount is the cap
            result = await marketWithFloor(outcome, maxSharesWad, floorCents, maxCost);
          } else {
            // No floor: input is shares directly
            const finalCostWad = tbQuote?.estimatedCost ?? parseUnits(estimatedValue.toFixed(6), 18);
            const maxCost = (finalCostWad * 110n) / 100n; // 10% slippage buffer
            result = await marketOrder(outcome, amountBg, maxCost);
          }
        } else {
          // V9.9.6: Use rangeOrder or limitOrder based on priceMode
          const maxCost = calculateMaxCost(outcome, amountBg, priceLowNum, priceHighNum);
          if (priceMode === 'single') {
            result = await limitOrder(outcome, amountBg, priceLowNum, maxCost);
          } else {
            result = await rangeOrder(outcome, amountBg, priceLowNum, priceHighNum, maxCost);
          }
        }
      } else {
        // ============= SELL ORDERS =============
        const userYesInternal = vault?.yesInternal ?? 0n;
        const userNoInternal = vault?.noInternal ?? 0n;
        const userHolding = isYes ? userYesInternal : userNoInternal;

        // V10.4: Wide ranges (>50 ticks) force short sell - can't use placeSpotSell
        const hasFullShares = !spotRangeExceedsLimit && userHolding >= amountBg;
        const hasPartialShares = !spotRangeExceedsLimit && userHolding > 0n && userHolding < amountBg;

        if (isMarketOrderType) {
          if (hasFullShares) {
            // PURE SPOT SELL MARKET - Use full tick range (1-999)
            const spotSellOutcome = (isYes ? 1 : 0) as 0 | 1;
            logger.order.log('SPOT SELL MARKET:', { isYes, outcome: spotSellOutcome, shares: amountBg.toString() });
            const spotResult = await placeSpotSell(spotSellOutcome, amountBg, 0.1, 99.9);
            if (spotResult) {
              result = { orderId: spotResult.sellId, filledShares: 0n, filledCost: 0n, restingShares: amountBg, txHash: spotResult.txHash };
            }
          } else if (hasPartialShares) {
            // HYBRID SELL MARKET: Spot sell owned shares + short sell remainder
            const spotSellOutcome = (isYes ? 1 : 0) as 0 | 1;
            const oppositeOutcome = (isYes ? 0 : 1) as 0 | 1;
            const shortSellAmount = amountBg - userHolding;
            logger.order.log('HYBRID SELL MARKET:', { isYes, spotAmount: userHolding.toString(), shortAmount: shortSellAmount.toString() });

            // Step 1: Spot sell owned shares
            const spotResult = await placeSpotSell(spotSellOutcome, userHolding, 0.1, 99.9);

            // Step 2: Short sell remainder (buy opposite)
            if (shortSellAmount > 0n) {
              const finalCostWad = tbQuote?.estimatedCost ?? parseUnits(estimatedValue.toFixed(6), 18);
              const shortCost = (finalCostWad * shortSellAmount * 110n) / (amountBg * 100n);
              await marketOrder(oppositeOutcome, shortSellAmount, shortCost);
            }

            if (spotResult) {
              result = { orderId: spotResult.sellId, filledShares: 0n, filledCost: 0n, restingShares: amountBg, txHash: spotResult.txHash };
            }
          } else {
            // SHORT SELL MARKET: Buy opposite outcome
            // Selling YES = Buying NO, Selling NO = Buying YES
            const oppositeOutcome = (isYes ? 0 : 1) as 0 | 1;
            const finalCostWad = tbQuote?.estimatedCost ?? parseUnits(estimatedValue.toFixed(6), 18);
            const maxCost = (finalCostWad * 110n) / 100n;
            logger.order.log('SHORT SELL MARKET:', { isYes, oppositeOutcome, maxCost: maxCost.toString() });
            result = await marketOrder(oppositeOutcome, amountBg, maxCost);
          }
        } else {
          // LIMIT ORDERS for SELL
          if (hasFullShares) {
            // PURE SPOT SELL LIMIT - Lock shares and place resting ask
            const spotSellOutcome = (isYes ? 1 : 0) as 0 | 1;
            logger.order.log('SPOT SELL LIMIT:', { isYes, outcome: spotSellOutcome, priceLow: priceLowNum, priceHigh: priceHighNum });
            const spotResult = await placeSpotSell(
              spotSellOutcome,
              amountBg,
              priceLowNum,
              priceMode === 'single' ? priceLowNum : priceHighNum
            );
            if (spotResult) {
              result = { orderId: spotResult.sellId, filledShares: 0n, filledCost: 0n, restingShares: amountBg, txHash: spotResult.txHash };
            }
          } else if (hasPartialShares) {
            // HYBRID SELL LIMIT: Spot sell owned shares + short sell remainder
            const spotSellOutcome = (isYes ? 1 : 0) as 0 | 1;
            const oppositeOutcome = (isYes ? 0 : 1) as 0 | 1;
            const shortSellAmount = amountBg - userHolding;
            const invertedPriceLow = 100 - priceHighNum;
            const invertedPriceHigh = 100 - priceLowNum;
            logger.order.log('HYBRID SELL LIMIT:', { isYes, spotAmount: userHolding.toString(), shortAmount: shortSellAmount.toString() });

            // Step 1: Spot sell owned shares
            const spotResult = await placeSpotSell(
              spotSellOutcome,
              userHolding,
              priceLowNum,
              priceMode === 'single' ? priceLowNum : priceHighNum
            );

            // Step 2: Short sell remainder (buy opposite at inverted price)
            if (shortSellAmount > 0n) {
              const maxCost = calculateMaxCost(oppositeOutcome, shortSellAmount, invertedPriceLow, invertedPriceHigh);
              if (priceMode === 'single') {
                await limitOrder(oppositeOutcome, shortSellAmount, invertedPriceLow, maxCost);
              } else {
                await rangeOrder(oppositeOutcome, shortSellAmount, invertedPriceLow, invertedPriceHigh, maxCost);
              }
            }

            if (spotResult) {
              result = { orderId: spotResult.sellId, filledShares: 0n, filledCost: 0n, restingShares: amountBg, txHash: spotResult.txHash };
            }
          } else {
            // SHORT SELL LIMIT: Buy opposite at inverted price
            // Selling YES @ 60% = Buying NO @ 40%
            // Selling NO @ 40% = Buying YES @ 60%
            const oppositeOutcome = (isYes ? 0 : 1) as 0 | 1;
            const invertedPriceLow = 100 - priceHighNum;
            const invertedPriceHigh = 100 - priceLowNum;
            const maxCost = calculateMaxCost(oppositeOutcome, amountBg, invertedPriceLow, invertedPriceHigh);
            logger.order.log('SHORT SELL:', { isYes, oppositeOutcome, invertedPriceLow, invertedPriceHigh, maxCost: maxCost.toString() });
            if (priceMode === 'single') {
              result = await limitOrder(oppositeOutcome, amountBg, invertedPriceLow, maxCost);
            } else {
              result = await rangeOrder(oppositeOutcome, amountBg, invertedPriceLow, invertedPriceHigh, maxCost);
            }
          }
        }
      }

      if (result) {
        invalidateV8Queries();
        setAmount('');
      }
    } catch (e: any) {
      const msg = e?.cause?.reason || e?.shortMessage || 'Trade failed';
      toast.error(msg);
      logger.trade.error('Trade failed:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isReady = launchpad ? (launchpad.canGraduate || (launchpad.graduationProgress ?? 0) >= 100) : false;

  // Not graduated - show lock screen once launchpad data is loaded
  // Don't wait for tickBook loading since tokens don't exist until graduation
  if (!launchpad?.isGraduated && !isReady && !isLoadingLaunchpad) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full p-8 rounded-2xl bg-gradient-to-b from-slate-800/20 to-transparent border border-slate-700/30 text-center">
          <Zap className="w-16 h-16 text-slate-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Pro Trading Locked</h2>
          <p className="text-slate-400 mb-6">This market hasn't graduated yet. Trade on the AMM first.</p>

          {launchpad && (
            <div className="mb-8 text-left bg-slate-950/50 p-4 rounded-xl border border-slate-800">
              <GraduationProgress
                bBase={launchpad.currentBBase ?? 0n}
                graduationThreshold={launchpad.graduationThreshold ?? 0n}
                isGraduated={launchpad.isGraduated ?? false}
                feesAccrued={launchpad.feesAccrued ?? 0n}
                isInTrialPeriod={launchpad.isInTrialPeriod}
                trialTimeRemaining={launchpad.trialTimeRemaining}
                isDismissed={launchpad.isDismissed}
              />
            </div>
          )}

          <Button onClick={() => navigate(`/trade/${marketAddr}`)} className="w-full bg-slate-600 hover:bg-slate-500 text-white">
            Go to AMM Trading
          </Button>
        </div>
      </div>
    );
  }

   // Settled/Finalized market - show settlement UI instead of trading
   if (truth?.isSettled === true || truth?.isFinalized === true || currentMarketStage === 'settled' || currentMarketStage === 'finalized') {
    const winningOutcome = truth?.winningOutcome ?? 0;
    const isFinalized = truth?.isFinalized === true || currentMarketStage === 'finalized';
    const yesBalance = vault?.yesInternal ?? 0n;
    const noBalance = vault?.noInternal ?? 0n;
    const hasPosition = yesBalance > 0n || noBalance > 0n;

    return (
      <div className="space-y-6">
        {!embedded && (
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/pro')}
              className="p-2 rounded-lg bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </button>
            <div className="flex-1">
              <div className="text-sm text-white font-medium line-clamp-1">{truth?.question || launchpad?.name}</div>
            </div>
          </div>
        )}

        {/* 60/40 Grid Layout - matches Trade page */}
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
          {/* LEFT COLUMN: Market Header + Settlement Card (60%) */}
          <div className="lg:col-span-6 space-y-4">
            <MarketDetailHeader
              name={truth?.question || launchpad?.name || 'Market'}
              symbol={staticMetadata?.symbol}
              address={marketAddr}
              creator={truth?.creator || launchpad?.creator || '0x0'}
              adjudicator={truth?.adjudicator}
              deadline={truth?.deadline}
              isGraduated={launchpad?.isGraduated || false}
              isExpired={Boolean(truth?.deadline && (Date.now() / 1000 > truth.deadline))}
              isLive={truth?.isLive ?? false}
              chainId={chainId}
              isInTrialPeriod={launchpad?.isInTrialPeriod}
              trialTimeRemaining={launchpad?.trialTimeRemaining}
              isDismissed={launchpad?.isDismissed}
              isSettled={truth?.isSettled ?? (currentMarketStage === 'settled')}
              isFinalized={truth?.isFinalized ?? (currentMarketStage === 'finalized')}
            />

            <Card className={isFinalized ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}>
              <div className="p-5 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800/50 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      {isFinalized ? (
                        <Trophy className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <Clock className="w-5 h-5 text-amber-400" />
                      )}
                      {isFinalized ? 'Market Finalized' : 'Market Settled'}
                    </h3>
                    <p className="text-slate-400 text-xs mt-1">
                      {isFinalized 
                        ? "Trading has ended and outcomes are final." 
                        : "Trading has ended. Waiting for veto period."}
                    </p>
                  </div>
                  {isFinalized ? (
                    <Badge variant="success" className="flex items-center gap-1 px-3 py-1">
                      <CheckCircle className="w-3 h-3" />
                      Finalized
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1 px-3 py-1">
                      <Clock className="w-3 h-3" />
                      Settled
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-900/40 rounded-xl p-4 border border-slate-800/50 flex flex-col justify-center items-center text-center">
                    <span className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Winning Outcome</span>
                    <div className="flex items-center gap-2">
                      {winningOutcome === 1 ? (
                        <div className="flex items-center gap-2 bg-emerald-500/10 px-4 py-2 rounded-lg border border-emerald-500/20">
                          <TrendingUp className="w-6 h-6 text-emerald-400" />
                          <span className="text-2xl font-black text-emerald-400">YES</span>
                        </div>
                      ) : winningOutcome === 0 ? (
                        <div className="flex items-center gap-2 bg-rose-500/10 px-4 py-2 rounded-lg border border-rose-500/20">
                          <TrendingDown className="w-6 h-6 text-rose-400" />
                          <span className="text-2xl font-black text-rose-400">NO</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 bg-slate-500/10 px-4 py-2 rounded-lg border border-slate-500/20">
                          <AlertCircle className="w-6 h-6 text-slate-400" />
                          <span className="text-2xl font-black text-slate-400">INVALID</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-900/40 rounded-xl p-4 border border-slate-800/50 flex flex-col justify-center items-center text-center">
                    <span className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Your Payout</span>
                    {hasPosition ? (
                      <div className="flex flex-col items-center">
                        <span className={`text-3xl font-mono font-bold tracking-tight ${(winningOutcome === 1 ? Number(yesBalance) : winningOutcome === 0 ? Number(noBalance) : 0) > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                          ${(winningOutcome === 1 ? Number(yesBalance) / 1e18 : winningOutcome === 0 ? Number(noBalance) / 1e18 : 0).toFixed(2)}
                        </span>
                        <span className="text-slate-500 text-xs mt-1 font-medium">
                          {(winningOutcome === 1 ? Number(yesBalance) : winningOutcome === 0 ? Number(noBalance) : 0) > 0 ? 'Ready to redeem' : 'Position lost'}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <span className="text-slate-400 text-sm italic">No position</span>
                      </div>
                    )}
                  </div>
                </div>

                {hasPosition && (
                  <div className="bg-slate-950/30 rounded-lg p-3 text-sm border border-slate-800/30">
                    <div className="flex justify-between items-center text-slate-400 text-xs mb-2 uppercase tracking-wider font-bold">
                      <span>Your Position</span>
                      <span>Shares</span>
                    </div>
                    {yesBalance > 0n && (
                      <div className="flex justify-between items-center py-1">
                        <span className={winningOutcome === 1 ? "text-emerald-400 font-bold" : "text-slate-500 line-through"}>YES Outcome</span>
                        <span className="font-mono text-slate-300">{(Number(yesBalance) / 1e18).toFixed(2)}</span>
                      </div>
                    )}
                    {noBalance > 0n && (
                      <div className="flex justify-between items-center py-1">
                        <span className={winningOutcome === 0 ? "text-emerald-400 font-bold" : "text-slate-500 line-through"}>NO Outcome</span>
                        <span className="font-mono text-slate-300">{(Number(noBalance) / 1e18).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-2">
                  {isFinalized && hasPosition && (winningOutcome === 1 ? yesBalance : winningOutcome === 0 ? noBalance : 0n) > 0n ? (
                    <div className="space-y-3">
                      <Button
                        variant="primary"
                        className="w-full h-12 text-base font-bold shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all"
                        onClick={async () => {
                          if (!contracts.TickBookVault || !writeContractAsync) return;
                          try {
                            await writeContractAsync({
                              address: contracts.TickBookVault as `0x${string}`,
                              abi: [{ name: 'redeemResolved', type: 'function', inputs: [{ name: 'market', type: 'address' }], outputs: [{ name: 'payoutWad', type: 'uint256' }], stateMutability: 'nonpayable' }],
                              functionName: 'redeemResolved',
                              args: [marketAddr],
                            });
                            invalidateV8Queries();
                          } catch (e: any) {
                            logger.trade.error('Redeem failed:', e);
                          }
                        }}
                      >
                        <Wallet className="w-5 h-5 mr-2" />
                        Redeem ${(winningOutcome === 1 ? Number(yesBalance) / 1e18 : winningOutcome === 0 ? Number(noBalance) / 1e18 : 0).toFixed(2)} Payout
                      </Button>
                      <p className="text-center text-slate-500 text-xs">
                        Funds will be sent directly to your wallet
                      </p>
                    </div>
                  ) : !isFinalized ? (
                    <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                      <Clock className="w-5 h-5 text-amber-400 shrink-0" />
                      <div>
                        <p className="text-amber-400 text-sm font-bold">Veto Period Active</p>
                        <p className="text-amber-400/70 text-xs mt-0.5">
                          Redemption available after adjudicator finalizes.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-2">
                      <p className="text-slate-500 text-sm">
                        {hasPosition ? "Better luck next time." : "No position to redeem."}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>

          {/* RIGHT COLUMN: Orders Panel (40%) */}
          <div className="lg:col-span-4">
            {userOrders && userOrders.length > 0 && tickBook?.marketKey && (
              <UserOrdersPanel
                orders={userOrders}
                spotSells={spotSells}
                marketKey={tickBook.marketKey as `0x${string}`}
                isLoading={isOrdersLoading}
                onRefresh={invalidateV8Queries}
                contracts={contracts as Record<string, string>}
                chainId={chainId}
                viewOutcome="yes"
                yesShares={vault?.yesInternal}
                noShares={vault?.noInternal}
                onCancelSpotSell={cancelSpotSell}
                pendingRefundsWad={pendingRefundsWad}
              />
            )}
          </div>
        </div>


      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button + Market Info (hidden when embedded) */}
      {!embedded && (
        <div className="space-y-3">
          {/* Top row: Back button + Market Info */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/pro')}
              className="p-2 rounded-lg bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-sm text-white font-medium line-clamp-1">{truth?.question || staticMetadata?.name || launchpad?.name || 'Select Market'}</div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <BarChart3 className="w-4 h-4 text-emerald-400" />
              <button onClick={() => invalidateV8Queries()} className="p-2 rounded-lg hover:bg-slate-800 transition-colors" title="Refresh">
                <RefreshCw className={cn("w-4 h-4 text-slate-500", isTickBookLoading && "animate-spin")} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Grid - 60/40 like Trade page */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">

        {/* LEFT COLUMN: Liquidity Map + Orders (60%) */}
        <div className="lg:col-span-6 space-y-4">
          {/* Embedded Mode: Compact Market Summary */}
          {embedded && (
            <Card className="bg-slate-900/60 border-slate-700/50 px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                <Badge variant="success" className="px-2 py-0.5 text-xs">
                  Graduated · 1% Fee
                </Badge>

                {truth?.deadline && truth.deadline > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Calendar size={11} />
                    <span className="font-mono">
                      {truth.deadline > 4102444800
                        ? 'No expiry'
                        : new Date(truth.deadline * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                )}

                <a href={getAddressExplorerUrl(chainId, marketAddr)} target="_blank" rel="noreferrer" title="View market on explorer">
                  <Badge variant="outline" className="font-mono text-xs px-2 py-0.5 hover:border-slate-500 transition-colors cursor-pointer">
                    ${marketAddr.slice(2, 10).toUpperCase()}
                  </Badge>
                </a>

                {truth?.creator && (
                  <a href={getAddressExplorerUrl(chainId, truth.creator)} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-slate-300 transition-colors" title="View creator">
                    <User size={11} />
                    <span className="font-mono">{truth.creator.slice(0, 6)}...{truth.creator.slice(-4)}</span>
                  </a>
                )}

                {truth?.adjudicator && (
                  <a href={getAddressExplorerUrl(chainId, truth.adjudicator)} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-slate-300 transition-colors" title="View adjudicator">
                    <Shield size={11} />
                    <span className="font-mono">{truth.adjudicator.slice(0, 6)}...{truth.adjudicator.slice(-4)}</span>
                  </a>
                )}
              </div>
            </Card>
          )}
          {/* Pixel Liquidity Map */}
          <div className="rounded-2xl bg-gradient-to-b from-slate-900/80 to-slate-950/80 border border-slate-800/50 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800/50 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Liquidity Map</span>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-emerald-400">◀ {isYes ? 'YES' : 'NO'} Bids</span>
                <span className="text-white font-bold">{isProPriceValid ? `${(isYes ? proPriceCents : 100 - proPriceCents).toFixed(1)}¢` : 'N/A'}</span>
                <span className="text-rose-400">{isYes ? 'NO' : 'YES'} Asks ▶</span>
              </div>
            </div>

            <div className="p-4">
              <LiquidityMap
                tickBook={tickBook as any}
                allOrders={allOrders ?? []}
                spotSells={spotSells ?? []}
                currentProb={currentProb}
                ammProb={ammProb}
                isLoading={isTickBookLoading || isAllOrdersLoading || isSpotSellsLoading}
                viewOutcome={isYes ? 'yes' : 'no'}
              />
            </div>
          </div>

          <UserOrdersPanel
            orders={userOrders ?? []}
            spotSells={spotSells ?? []}
            marketKey={tickBook?.marketKey as `0x${string}`}
            isLoading={isOrdersLoading}
            onRefresh={() => invalidateV8Queries()}
            contracts={contracts as any}
            chainId={chainId}
            viewOutcome={isYes ? 'yes' : 'no'}
            yesShares={vault?.yesInternal}
            noShares={vault?.noInternal}
            onCancelSpotSell={cancelSpotSell}
            pendingRefundsWad={pendingRefundsWad}
          />
        </div>

        {/* RIGHT COLUMN: Vault Card + Trading Panel (40%) */}
        <div className="lg:col-span-4 space-y-4">

          {/* Vault Card - Above Trading Panel */}
          <Card className="bg-gradient-to-b from-slate-900/80 to-slate-950/80 border-slate-800/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Wallet className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-bold text-white">Vault Balance</span>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="bg-slate-950/50 rounded-lg p-2 text-center">
                <div className="text-xs text-slate-500 uppercase">Wallet</div>
                <div className="font-mono text-sm text-white">${parseFloat(formatUnits(walletUsdc, decimals)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              </div>
              <div className="bg-slate-950/50 rounded-lg p-2 text-center">
                <div className="text-xs text-slate-500 uppercase">In Orders</div>
                <div className="font-mono text-sm text-slate-400">${parseFloat(formatUnits(vaultReserved, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              </div>
              <div className="bg-slate-950/50 rounded-lg p-2 text-center">
                <div className="text-xs text-slate-500 uppercase">Available</div>
                <div className="font-mono text-sm text-emerald-400">${parseFloat(formatUnits(vaultAvailable, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[120px]">
                <input
                  type="number"
                  placeholder="Amount"
                  value={vaultInput}
                  onChange={(e) => setVaultInput(e.target.value)}
                  className={`w-full px-3 py-2 pr-12 bg-slate-950 border rounded-lg text-sm font-mono focus:outline-none ${vaultInput && parseUnits(vaultInput || '0', decimals) > walletUsdc
                    ? 'border-rose-500 focus:border-rose-500'
                    : 'border-slate-700 focus:border-slate-500'
                    }`}
                />
                <button
                  type="button"
                  onClick={() => setVaultInput(formatUnits(walletUsdc, decimals))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 hover:text-slate-400"
                >
                  MAX
                </button>
              </div>
              {needsApproval ? (
                <Button onClick={handleApprove} disabled={isSubmitting} className="bg-slate-600 hover:bg-slate-500 text-white text-xs px-3">
                  {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Approve'}
                </Button>
              ) : (
                <>
                  <Button
                    onClick={handleDeposit}
                    disabled={!vaultInput || isSubmitting || parseUnits(vaultInput || '0', decimals) > walletUsdc}
                    className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs px-3"
                  >
                    <ArrowDownRight className="w-3 h-3 mr-1" /> Deposit
                  </Button>
                  <Button onClick={handleWithdraw} disabled={!vaultInput || isSubmitting} variant="ghost" className="bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 text-xs px-3 border-slate-600">
                    <ArrowUpRight className="w-3 h-3 mr-1" /> Withdraw
                  </Button>
                </>
              )}
            </div>
          </Card>


          {/* Trading Panel */}
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
                <div className="flex-1 flex gap-2 p-1 bg-slate-950/50 rounded-xl">
                  <button
                    onClick={() => setAction(isYes ? 'buy_yes' : 'buy_no')}
                    className={cn(
                      "flex-1 py-2.5 rounded-lg font-bold text-xs uppercase tracking-widest transition-all border-2",
                      isBuying
                        ? isYes
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/50 shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)]"
                          : "bg-rose-500/10 text-rose-400 border-rose-500/50 shadow-[0_0_20px_-5px_rgba(244,63,94,0.3)]"
                        : "bg-transparent text-slate-500 border-transparent hover:text-slate-300"
                    )}
                  >
                    Buy
                  </button>
                  <button
                    onClick={() => setAction(isYes ? 'sell_yes' : 'sell_no')}
                    className={cn(
                      "flex-1 py-2.5 rounded-lg font-bold text-xs uppercase tracking-widest transition-all border-2",
                      !isBuying
                        ? "bg-slate-500/10 text-slate-400 border-slate-500/50 shadow-[0_0_20px_-5px_rgba(245,158,11,0.3)]"
                        : "bg-transparent text-slate-500 border-transparent hover:text-slate-300"
                    )}
                  >
                    Sell
                  </button>
                </div>

                {/* Limit/Market Toggle - neutral styling */}
                <div className="flex gap-2 p-1 bg-slate-950/50 rounded-xl">
                  <button
                    onClick={() => setOrderType('limit')}
                    className={cn(
                      "flex-1 px-4 py-2.5 rounded-lg font-bold text-xs uppercase tracking-widest transition-all border-2",
                      orderType === 'limit'
                        ? isYes
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/50 shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)]"
                          : "bg-rose-500/10 text-rose-400 border-rose-500/50 shadow-[0_0_20px_-5px_rgba(244,63,94,0.3)]"
                        : "bg-transparent text-slate-500 border-transparent hover:text-slate-300"
                    )}
                  >
                    Limit
                  </button>
                </div>
              </div>

              {/* Price Input (Limit only) */}
              {orderType === 'limit' && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center mb-1">
                    <div className="text-xs text-slate-500 uppercase tracking-widest font-bold">Price</div>
                    <div className="text-xs text-slate-600 font-mono">0.1¢ — 99.9¢</div>
                  </div>

                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex-1 flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type="number"
                          step="0.1"
                          value={priceLow}
                          onChange={(e) => setPriceLow(e.target.value)}
                          onBlur={() => {
                            let val = Math.max(0.1, Math.min(99.9, Number(priceLow)));
                            setPriceLow(val.toFixed(1));
                            if (priceMode === 'single') setPriceHigh(val.toFixed(1));
                            else if (val >= priceHighNum) setPriceHigh((val + 0.1).toFixed(1));
                          }}
                          className={cn(
                            "w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-lg font-mono font-bold text-center focus:outline-none transition-all",
                            isYes ? "focus:border-emerald-500/50" : "focus:border-rose-500/50"
                          )}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-lg font-bold pointer-events-none">¢</span>
                      </div>

                      {priceMode === 'range' && (
                        <>
                          <div className="text-slate-700 font-bold">—</div>
                          <div className="relative flex-1">
                            <input
                              type="number"
                              step="0.1"
                              value={priceHigh}
                              onChange={(e) => setPriceHigh(e.target.value)}
                              onBlur={() => {
                                let val = Math.max(0.1, Math.min(99.9, Number(priceHigh)));
                                setPriceHigh(val.toFixed(1));
                                if (val <= priceLowNum) setPriceLow((val - 0.1).toFixed(1));
                              }}
                              className={cn(
                                "w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-lg font-mono font-bold text-center focus:outline-none transition-all",
                                isYes ? "focus:border-emerald-500/50" : "focus:border-rose-500/50"
                              )}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-lg font-bold pointer-events-none">¢</span>
                          </div>
                        </>
                      )}
                    </div>

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
                        "h-[48px] px-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center border-2",
                        priceMode === 'range'
                          ? isYes
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/50 shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)]"
                            : "bg-rose-500/10 text-rose-400 border-rose-500/50 shadow-[0_0_20px_-5px_rgba(244,63,94,0.3)]"
                          : "bg-slate-900/50 text-slate-500 border-slate-800 hover:text-slate-300 hover:border-slate-700"
                      )}
                    >
                      {priceMode === 'single' ? '± Range' : 'Single'}
                    </button>
                  </div>

                  {/* Slider Control */}
                  <div className="space-y-2 mb-4 px-1">
                    <div
                      ref={trackRef}
                      className="relative h-6 flex items-center group cursor-default"
                    >
                      <div className="absolute inset-x-0 h-1 bg-slate-800/80 rounded-full" />

                      <div
                        className={cn(
                          "absolute h-1 rounded-full pointer-events-none",
                          isYes
                            ? "bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                            : "bg-gradient-to-r from-rose-600 to-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.2)]"
                        )}
                        style={priceMode === 'single'
                          ? { left: '0%', width: `${priceLowNum}%` }
                          : { left: `${priceLowNum}%`, width: `${Math.max(0.2, priceHighNum - priceLowNum)}%` }
                        }
                      />

                      {/* Visual Handles - Now with pointer interaction */}
                      <div
                        onPointerDown={(e) => {
                          e.preventDefault();
                          setIsLowDragging(true);
                        }}
                        className={cn(
                          "absolute w-5 h-5 rounded-full border-2 border-white shadow-[0_0_15px_rgba(0,0,0,0.6)] z-20 transition-transform cursor-grab active:cursor-grabbing hover:scale-110",
                          isYes ? "bg-emerald-500" : "bg-rose-500",
                          isLowDragging && "scale-125"
                        )}
                        style={{ left: `calc(${priceLowNum}% - 10px)` }}
                      />
                      {priceMode === 'range' && (
                        <div
                          onPointerDown={(e) => {
                            e.preventDefault();
                            setIsHighDragging(true);
                          }}
                          className={cn(
                            "absolute w-5 h-5 rounded-full border-2 border-white shadow-[0_0_15px_rgba(0,0,0,0.6)] z-20 transition-transform cursor-grab active:cursor-grabbing hover:scale-110",
                            isYes ? "bg-emerald-200" : "bg-rose-200",
                            isHighDragging && "scale-125"
                          )}
                          style={{ left: `calc(${priceHighNum}% - 10px)` }}
                        />
                      )}
                    </div>

                    <div className="text-center text-xs font-mono">
                      {priceMode === 'single'
                        ? <span className="text-slate-500">Tick <span className={cn(isYes ? "text-emerald-400" : "text-rose-400")}>{Math.round(priceLowNum * 10)}</span></span>
                        : <span className={cn("text-slate-500", !isBuying && spotRangeExceedsLimit && "text-slate-500")}>
                          <span className={cn("font-bold", (!isBuying && spotRangeExceedsLimit) ? "text-slate-400" : (isYes ? "text-emerald-400" : "text-rose-400"))}>{numTicks}</span>
                          {(!isBuying && spotRangeExceedsLimit) ? <span> ticks <span className="text-slate-400">(short only)</span></span> : ' ticks'}
                        </span>
                      }
                    </div>
                  </div>


                </div>
              )}

              {/* Amount Input */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs text-slate-500 uppercase tracking-wider">
                    {orderType === 'market' && useFloorPrice ? 'Amount (USDC)' : 'Amount (Shares)'}
                  </label>
                  <span className="text-xs text-slate-600 font-mono">
                    Max: {parseFloat(formatUnits(vaultAvailable, 18)).toLocaleString()}
                  </span>
                </div>
                <input
                  type="number"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-xl font-mono font-bold focus:border-slate-500 focus:outline-none"
                />
                {/* Quick amount buttons - USDC for market+floor, shares otherwise */}
                <div className="flex gap-2 mt-2">
                  {(orderType === 'market' && useFloorPrice ? [50, 100, 500] : [100, 500, 1000]).map(a => (
                    <button
                      key={a}
                      onClick={() => setAmount(a.toString())}
                      className="flex-1 py-1 text-xs font-mono text-slate-500 hover:text-white bg-slate-900 hover:bg-slate-800 rounded transition-colors"
                    >
                      {orderType === 'market' && useFloorPrice ? `$${a}` : a}
                    </button>
                  ))}
                </div>
              </div>

              {/* Order Summary */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                {orderType === 'limit' && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">
                      {priceMode === 'single' ? 'Price' : 'Price Range'}
                    </span>
                    <span className="font-mono text-slate-400">
                      {priceMode === 'single'
                        ? `${priceLowNum.toFixed(1)}¢`
                        : `${priceLowNum.toFixed(1)}¢ – ${priceHighNum.toFixed(1)}¢`}
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
                  <span className="text-slate-500">
                    {isBuying ? 'Est. Cost' : sellType === 'spot' ? 'Est. Return' : 'Est. Cost'}
                  </span>
                  <span className={cn(
                    "font-mono",
                    isBuying ? "text-white" : sellType === 'spot' ? "text-emerald-400" : "text-white"
                  )}>
                    {amountNum > 0
                      ? `${sellType === 'spot' ? '+' : ''}$${estimatedValue.toFixed(2)}`
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
                  <span>Insufficient vault balance. Deposit more above.</span>
                </div>
              )}

              {/* Sell Mode Info (shows what type of sell will execute) */}
              {amount && !isBuying && (() => {
                const shares = isYes ? (vault?.yesInternal ?? 0n) : (vault?.noInternal ?? 0n);
                const needed = parseUnits(amount, 18);
                const hasAll = shares >= needed;
                const hasPartial = shares > 0n && shares < needed;
                const hasNone = shares === 0n;

                // V10.4: Wide ranges (>50 ticks) force short sell even if user has shares
                if (spotRangeExceedsLimit) {
                  const neededFmt = parseFloat(formatUnits(needed, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 });
                  return (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-800/30 border border-slate-700/30 text-slate-400 text-xs">
                      <span>📉 Short Sell: Range too wide for spot ({numTicks} ticks &gt; 50). Buying {neededFmt} {isYes ? 'NO' : 'YES'} instead.</span>
                    </div>
                  );
                }

                if (hasAll) {
                  const neededFmt = parseFloat(formatUnits(needed, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 });
                  const sharesFmt = parseFloat(formatUnits(shares, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 });
                  return (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-950/30 border border-emerald-900/30 text-emerald-400 text-xs">
                      <Package className="w-3.5 h-3.5 shrink-0" />
                      <span>Spot Sell: Selling {neededFmt} of your {sharesFmt} {isYes ? 'YES' : 'NO'} shares</span>
                    </div>
                  );
                } else if (hasPartial) {
                  const spotFmt = parseFloat(formatUnits(shares, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 });
                  const shortFmt = parseFloat(formatUnits(needed - shares, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 });
                  return (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-800/30 border border-slate-700/30 text-slate-400 text-xs">
                      <ArrowLeftRight className="w-3.5 h-3.5 shrink-0" />
                      <span>Hybrid Sell: {spotFmt} spot + {shortFmt} short ({isYes ? 'NO' : 'YES'} buy)</span>
                    </div>
                  );
                } else if (hasNone) {
                  const neededFmt = parseFloat(formatUnits(needed, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 });
                  return (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-950/30 border border-blue-900/30 text-blue-400 text-xs">
                      <TrendingDown className="w-3.5 h-3.5 shrink-0" />
                      <span>Short Sell: Buying {neededFmt} {isYes ? 'NO' : 'YES'} (equivalent to selling {isYes ? 'YES' : 'NO'})</span>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Execute Button */}
              <Button
                onClick={handleTrade}
                disabled={!isConnected || !amount || isSubmitting || isTickBookLoading || isCollateralizerLoading || !tickBook?.isActive || (isBuying && !hasEnoughBalance)}
                className={cn(
                  "w-full py-4 text-lg font-bold uppercase tracking-wider rounded-xl transition-all",
                  action === 'buy_yes' && "bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 shadow-lg shadow-emerald-600/25",
                  action === 'buy_no' && "bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 shadow-lg shadow-rose-600/25",
                  (action === 'sell_yes' || action === 'sell_no') && "bg-gradient-to-r from-slate-600 to-slate-500 hover:from-slate-500 hover:to-slate-400 shadow-lg shadow-slate-600/25",
                  (!isConnected || !amount || isSubmitting || isTickBookLoading || isCollateralizerLoading || !tickBook?.isActive || (isBuying && !hasEnoughBalance)) && "opacity-50 cursor-not-allowed"
                )}
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                ) : !isConnected ? (
                  'Connect Wallet'
                ) : (isTickBookLoading || isCollateralizerLoading || !tickBook) ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Initializing...
                  </span>
                ) : !tickBook.isActive ? (
                  'TickBook Not Initialized'
                ) : !amount ? (
                  'Enter Amount'
                ) : (
                  `${isBuying ? 'Buy' : 'Sell'} ${isYes ? 'YES' : 'NO'} ${isBuying ? 'with' : 'for'} $${estimatedValue.toFixed(2)}`
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
