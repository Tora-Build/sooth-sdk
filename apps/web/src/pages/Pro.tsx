/**
 * Pro Page - SoothBook Trading Terminal
 * 
 * Shows only graduated markets with SoothBook orderbook trading.
 * 4 atomic actions: buyYes, buyNo, mint, merge + cancel + redeem.
 */
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Zap, Wallet, RefreshCw, AlertCircle, Loader2, ArrowLeft, BookOpen, TrendingUp, ChevronLeft, ChevronRight, ExternalLink, Package, TrendingDown, BarChart3, Calendar, User, Shield, Trophy, XCircle, CheckCircle, Clock
} from 'lucide-react';
import { useAccount, useChainId, useWriteContract, useReadContract, usePublicClient } from 'wagmi';
import { logger } from '../lib/logger';
import { parseUnits, formatUnits, encodePacked, keccak256 } from 'viem';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { MarketHeader } from '../components/features/MarketHeader';
import { MarketDetailHeader } from '../components/features/launchpad/MarketDetailHeader';
import { GraduationProgress } from '../components/features/launchpad/GraduationProgress';
import {
  useLaunchpadMarketDirect,
  useTruthMarketDirect,
  useCollateralizerDirect,
  useTokenBalances,
  useInvalidateQueries,
  useOnChainMarkets,
  useOrderbook,
  useOrderbookTrade,
  useAmmMarketByAddress,
  useSoothBookMarket,
  useSoothBookFeed,
  useSoothBookMarkets,
} from '../hooks';
import { useDeployments } from '../hooks/useDeployments';
import { ERC20_ABI } from '../config/abis';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';
import { useChainStore } from '../store/useChainStore';
import { LiquidityMap, UserOrdersPanel } from '../components/features/pro';

type OrderAction = 'buy_yes' | 'sell_yes' | 'buy_no' | 'sell_no';

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'sports', label: 'Sports' },
  { id: 'cultures', label: 'Cultures' },
  { id: 'others', label: 'Others' },
];

// Stages for Pro - graduated markets (live, settled, finalized) can trade on SoothBook
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

  const { markets: onChainMarkets, isLoading: isLoadingOnChainMarkets } = useOnChainMarkets();
  const { markets: soothBookMarkets, isLoading: isLoadingSoothBookMarkets } = useSoothBookMarkets(chainId);

  const soothBookMarketKeys = useMemo(() => new Set(soothBookMarkets.map((m) => m.marketKey.toLowerCase())), [soothBookMarkets]);

  const allMarkets = useMemo(() => {
    const eligibleMarkets = onChainMarkets.filter((m) => {
      const marketKey = keccak256(encodePacked(['address'], [m.address as `0x${string}`])).toLowerCase();
      return soothBookMarketKeys.has(marketKey);
    });

    return eligibleMarkets.map((m) => {
      const key = keccak256(encodePacked(['address'], [m.address as `0x${string}`]));
      const indexed = soothBookMarkets.find((sm) => sm.marketKey.toLowerCase() === key.toLowerCase());
      const derivedStage: 'live' | 'settled' | 'finalized' = indexed?.finalized
        ? 'finalized'
        : indexed?.active
          ? 'live'
          : 'settled';

      return {
        contractAddress: m.address,
        marketKey: key,
        name: m.name || key,
        symbol: m.symbol || key.slice(2, 8).toUpperCase(),
        category: 'others',
        isGraduated: true,
        isSettled: derivedStage === 'settled',
        isDismissed: false,
        stage: derivedStage,
        creator: m.creator,
        createdAt: m.createdAt,
      };
    });
  }, [onChainMarkets, soothBookMarketKeys, soothBookMarkets]);

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
        title="Pro Trading on SoothBook"
        hint="SoothBook is an on-chain orderbook with 999 price ticks (0.1% to 99.9%). Place limit orders or provide concentrated liquidity across price ranges. Makers earn from taker fills with no fees. Available only for graduated markets."
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
      {(isLoadingOnChainMarkets || isLoadingSoothBookMarkets) ? (
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
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  // UI State
  const [action, setAction] = useState<OrderAction>('buy_yes');
  const [price, setPrice] = useState('50.0');
  const [amount, setAmount] = useState('1');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mintMergeTab, setMintMergeTab] = useState<'mint' | 'merge'>('mint');
  const [mintMergeAmount, setMintMergeAmount] = useState('');

  const trackRef = React.useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const marketAddr = marketId as `0x${string}`;
  const { markets: onChainMarkets } = useOnChainMarkets();
  const staticMetadata = useMemo(() => {
    const market = onChainMarkets.find((m) => m.address.toLowerCase() === marketAddr.toLowerCase());
    if (!market) return undefined;
    return { name: market.name, symbol: market.symbol, category: 'others' };
  }, [onChainMarkets, marketAddr]);
  const marketKey = useMemo(() => keccak256(encodePacked(['address'], [marketAddr])), [marketAddr]);
  const invalidateV8Queries = useInvalidateQueries();

  const { markets: indexedMarkets } = useSoothBookMarkets(chainId);
  const currentMarketStage = useMemo(() => {
    const indexed = indexedMarkets.find((m) => m.marketKey.toLowerCase() === marketKey.toLowerCase());
    if (indexed?.finalized) return 'finalized';
    if (indexed?.active) return 'live';
    return 'settled';
  }, [indexedMarkets, marketKey]);

  const { launchpad, isLoading: isLoadingLaunchpad } = useLaunchpadMarketDirect(marketAddr);
  const { market: ammMarket } = useAmmMarketByAddress(marketAddr);
  const { market: truth } = useTruthMarketDirect(marketAddr);
  const { isLoading: isCollateralizerLoading } = useCollateralizerDirect(marketAddr);
  const { marketState, prices, isLoading: isSoothBookLoading } = useSoothBookMarket(contracts.SoothBook as `0x${string}` | undefined, marketKey);
  const {
    bids,
    asks,
    isLoading: isOrderbookLoading,
    refetch: refetchOrderbook,
    userYesShares,
    userNoShares,
    yesTokenAddress,
    noTokenAddress,
  } = useOrderbook(marketAddr);
  const {
    placeOrder,
    cancelOrder,
    mint: mintShares,
    merge: mergeShares,
    redeem,
    availableBalance,
    refetchBalance,
  } = useOrderbookTrade(marketAddr);
  const { feed: soothFeed, refresh: refreshFeed } = useSoothBookFeed(contracts.SoothBook as `0x${string}` | undefined, marketKey);
  const ammProb = ammMarket?.priceYes ?? 0.5;

  const tickBook = useMemo(() => {
    const bestBidFromBook = bids.reduce((max, level) => {
      const p = Number(level.yesPrice);
      return Number.isFinite(p) && p > max ? p : max;
    }, 0);
    const bestAskFromBook = asks.reduce((min, level) => {
      const p = Number(level.yesPrice);
      return Number.isFinite(p) && p > 0 && p < min ? p : min;
    }, 1);

    const bestBidFromContract = prices.yesPrice ? Number(formatUnits(prices.yesPrice, 18)) : 0;
    const bestAskFromContract = prices.noPrice ? 1 - Number(formatUnits(prices.noPrice, 18)) : 0;

    const bestBid = bestBidFromBook > 0 ? bestBidFromBook : bestBidFromContract;
    const bestAskAsYes = bestAskFromBook < 1 ? bestAskFromBook : bestAskFromContract;
    const midpoint = (bestBid > 0 && bestAskAsYes > 0) ? (bestBid + bestAskAsYes) / 2
      : bestBid > 0 ? bestBid
      : bestAskAsYes > 0 ? bestAskAsYes
      : 0;

    const bestYesTick = bestBid > 0 ? Math.round(bestBid * 1000) : (prices.bestYesTick ?? 0);
    return {
      marketKey,
      currentTick: bestYesTick,
      probability: midpoint,
      isActive: marketState.isActive,
      bids,
      asks,
    };
  }, [asks, bids, marketKey, marketState.isActive, prices.bestYesTick, prices.noPrice, prices.yesPrice]);

  const yesBalanceWad = parseUnits((userYesShares || 0).toString(), 18);
  const noBalanceWad = parseUnits((userNoShares || 0).toString(), 18);

  const isOrdersLoading = isOrderbookLoading;
  const isSoothBookDataLoading = isSoothBookLoading || isOrderbookLoading;

  const { balances } = useTokenBalances(useMemo(() => [
    contracts.MockUSDC as `0x${string}`
  ].filter(Boolean) as `0x${string}`[], [contracts.MockUSDC]));

  const { data: usdcDecimals } = useReadContract({
    address: contracts.MockUSDC as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'decimals',
    query: { enabled: !!contracts.MockUSDC, staleTime: Infinity },
  });
  const decimals = Number(usdcDecimals ?? 18);

  const walletUsdc = balances[0] ?? 0n;

  // Approval check
  const { data: vaultAllowance } = useReadContract({
    address: contracts.MockUSDC as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: isConnected && contracts.SoothBook ? [userAddress!, contracts.SoothBook as `0x${string}`] : undefined,
    query: { enabled: !!isConnected && !!contracts.SoothBook && !!contracts.MockUSDC }
  });

  // Derived UI State
  const isBuying = action === 'buy_yes' || action === 'buy_no';
  const isYes = action === 'buy_yes' || action === 'sell_yes';

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!isDragging || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    let percent = Math.max(0.1, Math.min(99.9, (x / rect.width) * 100));
    percent = Math.round(percent * 10) / 10;
    setPrice(percent.toFixed(1));
  }, [isDragging]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      return () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
      };
    }
  }, [isDragging, handlePointerMove, handlePointerUp]);

  const needsApproval = useMemo(() => {
    return ((vaultAllowance as bigint) ?? 0n) < parseUnits('1000', decimals);
  }, [vaultAllowance, decimals]);

  const currentTick = tickBook?.currentTick ?? 0;
  const rawProb = tickBook?.probability ?? null;
  const isMarketActive = tickBook?.isActive ?? false;

  // Last trade price from most recent OrderFilled event
  const lastTradePrice = useMemo(() => {
    const lastFill = soothFeed.find((item) => item.type === 'filled');
    if (!lastFill) return null;
    // tick format is "yesTick/noTick"
    const [yesTickStr] = lastFill.tick.split('/');
    const yesTick = Number(yesTickStr);
    return yesTick > 0 ? yesTick / 1000 : null;
  }, [soothFeed]);

  const displayPrice = lastTradePrice ?? (rawProb !== null && rawProb > 0 ? rawProb : null);
  const isProPriceValid = isMarketActive && displayPrice !== null;
  const proPriceCents = displayPrice !== null ? displayPrice * 100 : 0;

  if (tickBook) {
    logger.market.log(`Market ${marketAddr} - currentTick: ${currentTick}, lastTradePrice: ${lastTradePrice}, impliedProb: ${rawProb}, isActive: ${isMarketActive}`);
  }
  const rawBookProb = tickBook?.probability ?? null;
  const tickBookProb = displayPrice ?? (isMarketActive && rawBookProb !== null && rawBookProb > 0 ? rawBookProb : null);
  const currentProb = tickBookProb ?? 0.5;

  const priceNum = parseFloat(price) || 50;
  const amountNum = parseFloat(amount) || 0;
  const mintMergeAmountNum = Number(mintMergeAmount);
  const mintMergeDisplayAmount = Number.isFinite(mintMergeAmountNum) && mintMergeAmountNum > 0
    ? mintMergeAmountNum.toFixed(2)
    : '0.00';

  const estimatedValue = useMemo(() => {
    if (!amountNum) return 0;
    const p = priceNum / 100;
    if (action === 'buy_yes') return amountNum * p;
    if (action === 'buy_no') return amountNum * (1 - p);
    if (action === 'sell_yes') return amountNum * p;
    if (action === 'sell_no') return amountNum * (1 - p);
    return 0;
  }, [amountNum, priceNum, action]);

  const hasEnoughBalance = useMemo(() => {
    if (isBuying) {
      return availableBalance >= parseUnits(estimatedValue.toFixed(2), 18);
    }
    const shares = isYes ? yesBalanceWad : noBalanceWad;
    return shares >= parseUnits((amountNum || 0).toString(), 18);
  }, [isBuying, availableBalance, estimatedValue, isYes, yesBalanceWad, noBalanceWad, amountNum]);

  const handleApprove = async () => {
    setIsSubmitting(true);
    const toastId = toast.loading('Submitting approval...');
    try {
      const hash = await writeContractAsync({
        address: contracts.MockUSDC as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [contracts.SoothBook as `0x${string}`, parseUnits('1000000000', decimals)],
      });

      toast.loading('Waiting for confirmation...', { id: toastId });

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }

      invalidateV8Queries();
      toast.success(
        <div className="flex items-center gap-2">
          <span>SoothBook approved!</span>
          <a href={getExplorerUrl(chainId, hash)} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-slate-300">
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>,
        { id: toastId }
      );
    } catch (e: unknown) {
      const err = e as { cause?: { reason?: string }; shortMessage?: string };
      const msg = err?.cause?.reason || err?.shortMessage || 'Approval failed';
      toast.error(msg, { id: toastId });
      logger.trade.error('Approval failed:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTrade = async () => {
    if (!amount || !tickBook?.marketKey) return;
    setIsSubmitting(true);
    try {
      const outcome = (isYes ? 0 : 1) as 0 | 1;
      const priceProb = Math.max(0.001, Math.min(0.999, priceNum / 100));
      await placeOrder(outcome, priceProb.toFixed(3), amount, isBuying);
      refetchOrderbook();
      refetchBalance();
      refreshFeed();
      invalidateV8Queries();
      setAmount('');
    } catch (e: unknown) {
      const err = e as { cause?: { reason?: string }; shortMessage?: string };
      const msg = err?.cause?.reason || err?.shortMessage || 'Trade failed';
      toast.error(msg);
      logger.trade.error('Trade failed:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMintMerge = async () => {
    if (!mintMergeAmount) return;
    setIsSubmitting(true);
    try {
      if (mintMergeTab === 'mint') {
        await mintShares(mintMergeAmount);
      } else {
        await mergeShares(mintMergeAmount);
      }
      refetchOrderbook();
      refetchBalance();
      refreshFeed();
      invalidateV8Queries();
      setMintMergeAmount('');
    } catch (e: unknown) {
      const err = e as { cause?: { reason?: string }; shortMessage?: string };
      const msg = err?.cause?.reason || err?.shortMessage || `${mintMergeTab === 'mint' ? 'Mint' : 'Merge'} failed`;
      toast.error(msg);
      logger.trade.error(`${mintMergeTab} failed:`, e);
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
    const yesBalance = yesBalanceWad;
    const noBalance = noBalanceWad;
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
                          try {
                            await redeem();
                            refetchOrderbook();
                            refetchBalance();
                            refreshFeed();
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
            {tickBook?.marketKey && (
              <UserOrdersPanel
                marketId={marketAddr}
                marketKey={tickBook.marketKey as `0x${string}`}
                soothBookAddress={contracts.SoothBook as `0x${string}` | undefined}
                isLoading={isOrdersLoading}
                onRefresh={invalidateV8Queries}
                chainId={chainId}
                viewOutcome="yes"
                onCancelOrder={cancelOrder}
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
                <RefreshCw className={cn("w-4 h-4 text-slate-500", isSoothBookDataLoading && "animate-spin")} />
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
                <span className="font-bold text-cyan-400">{isProPriceValid ? `${(isYes ? proPriceCents : 100 - proPriceCents).toFixed(1)}¢` : 'N/A'}</span>
                <span className="text-rose-400">{isYes ? 'NO' : 'YES'} Asks ▶</span>
              </div>
            </div>

            <div className="p-4">
              <LiquidityMap
                bids={bids}
                asks={asks}
                currentProb={currentProb}
                ammProb={ammProb}
                isLoading={isSoothBookDataLoading}
                viewOutcome={isYes ? 'yes' : 'no'}
              />
            </div>
          </div>

          <UserOrdersPanel
            marketId={marketAddr}
            marketKey={tickBook?.marketKey as `0x${string}`}
            soothBookAddress={contracts.SoothBook as `0x${string}` | undefined}
            isLoading={isOrdersLoading}
            onRefresh={() => invalidateV8Queries()}
            chainId={chainId}
            viewOutcome={isYes ? 'yes' : 'no'}
            onCancelOrder={cancelOrder}
          />
        </div>

        {/* RIGHT COLUMN: Wallet + Trading Panel + Mint/Merge (40%) */}
        <div className="lg:col-span-4 space-y-4">

          <Card className="bg-gradient-to-b from-slate-900/80 to-slate-950/80 border-slate-800/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Wallet className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-bold text-white">Wallet Balance</span>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="bg-slate-950/50 rounded-lg p-2 text-center">
                <div className="text-xs text-slate-500 uppercase">USDC</div>
                <div className="font-mono text-sm text-white">${parseFloat(formatUnits(walletUsdc, decimals)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              </div>
              <div className="bg-emerald-950/20 rounded-lg p-2 text-center border border-emerald-900/20">
                <div className="text-xs text-emerald-500/80 uppercase flex items-center justify-center gap-1">
                  <span>YES</span>
                  {(marketState.yesToken ?? yesTokenAddress) && (
                    <a
                      href={getAddressExplorerUrl(chainId, marketState.yesToken ?? yesTokenAddress ?? '')}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-emerald-300 transition-colors"
                      title={`View YES token ${(marketState.yesToken ?? yesTokenAddress) || ''} on explorer`}
                    >
                      ↗
                    </a>
                  )}
                </div>
                {(marketState.yesToken ?? yesTokenAddress) ? (
                  <a
                    href={getAddressExplorerUrl(chainId, marketState.yesToken ?? yesTokenAddress ?? '')}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-sm text-white hover:text-emerald-300 transition-colors underline-offset-2 hover:underline"
                    title={`View YES token ${(marketState.yesToken ?? yesTokenAddress) || ''} on explorer`}
                  >
                    {(userYesShares ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </a>
                ) : (
                  <div className="font-mono text-sm text-white">{(userYesShares ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                )}
              </div>
              <div className="bg-rose-950/20 rounded-lg p-2 text-center border border-rose-900/20">
                <div className="text-xs text-rose-500/80 uppercase flex items-center justify-center gap-1">
                  <span>NO</span>
                  {(marketState.noToken ?? noTokenAddress) && (
                    <a
                      href={getAddressExplorerUrl(chainId, marketState.noToken ?? noTokenAddress ?? '')}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-rose-300 transition-colors"
                      title={`View NO token ${(marketState.noToken ?? noTokenAddress) || ''} on explorer`}
                    >
                      ↗
                    </a>
                  )}
                </div>
                {(marketState.noToken ?? noTokenAddress) ? (
                  <a
                    href={getAddressExplorerUrl(chainId, marketState.noToken ?? noTokenAddress ?? '')}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-sm text-white hover:text-rose-300 transition-colors underline-offset-2 hover:underline"
                    title={`View NO token ${(marketState.noToken ?? noTokenAddress) || ''} on explorer`}
                  >
                    {(userNoShares ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </a>
                ) : (
                  <div className="font-mono text-sm text-white">{(userNoShares ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                )}
              </div>
            </div>

            {needsApproval && (
              <div className="pt-3 border-t border-slate-800">
                <Button onClick={handleApprove} disabled={isSubmitting} className="w-full bg-slate-600 hover:bg-slate-500 text-white text-xs">
                  {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Approve SoothBook for USDC'}
                </Button>
              </div>
            )}
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
              <div className="flex gap-2 p-1 bg-slate-950/50 rounded-xl">
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

              <div className="space-y-3">
                <div className="flex justify-between items-center mb-1">
                  <div className="text-xs text-slate-500 uppercase tracking-widest font-bold">Price</div>
                  <div className="text-xs text-slate-600 font-mono">0.1¢ — 99.9¢</div>
                </div>

                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    onBlur={() => {
                      const val = Math.max(0.1, Math.min(99.9, Number(price)));
                      setPrice(val.toFixed(1));
                    }}
                    className={cn(
                      "w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-lg font-mono font-bold text-center focus:outline-none transition-all",
                      isYes ? "focus:border-emerald-500/50" : "focus:border-rose-500/50"
                    )}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-lg font-bold pointer-events-none">¢</span>
                </div>

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
                      style={{ left: '0%', width: `${priceNum}%` }}
                    />

                    <div
                      onPointerDown={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                      }}
                      className={cn(
                        "absolute w-5 h-5 rounded-full border-2 border-white shadow-[0_0_15px_rgba(0,0,0,0.6)] z-20 transition-transform cursor-grab active:cursor-grabbing hover:scale-110",
                        isYes ? "bg-emerald-500" : "bg-rose-500",
                        isDragging && "scale-125"
                      )}
                      style={{ left: `calc(${priceNum}% - 10px)` }}
                    />
                  </div>

                  <div className="text-center text-xs font-mono">
                    <span className="text-slate-500">Tick <span className={cn(isYes ? "text-emerald-400" : "text-rose-400")}>{Math.round(priceNum * 10)}</span></span>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs text-slate-500 uppercase tracking-wider">Amount (Shares)</label>
                  <span className="text-xs text-slate-600 font-mono">
                    Max: {isBuying
                      ? parseFloat(formatUnits(availableBalance, 18)).toLocaleString()
                      : (isYes ? userYesShares ?? 0 : userNoShares ?? 0).toLocaleString()
                    }
                  </span>
                </div>
                <input
                  type="number"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-xl font-mono font-bold focus:border-slate-500 focus:outline-none"
                />
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

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Price</span>
                  <span className="font-mono text-slate-400">{priceNum.toFixed(1)}¢</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">{isBuying ? 'Est. Cost' : 'Est. Return'}</span>
                  <span className={cn("font-mono", isBuying ? "text-white" : "text-emerald-400")}>
                    {amountNum > 0 ? `${!isBuying ? '+' : ''}$${estimatedValue.toFixed(2)}` : '–'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">
                    {isBuying ? 'Available USDC' : `Your ${isYes ? 'YES' : 'NO'} Shares`}
                  </span>
                  <span className={cn("font-mono", hasEnoughBalance ? "text-emerald-400" : "text-rose-400")}>
                    {isBuying
                      ? `$${parseFloat(formatUnits(availableBalance, 18)).toFixed(2)}`
                      : parseFloat(formatUnits(isYes ? yesBalanceWad : noBalanceWad, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 })
                    }
                  </span>
                </div>
              </div>

              {amount && isBuying && !hasEnoughBalance && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-950/30 border border-rose-900/30 text-rose-400 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Insufficient USDC balance.</span>
                </div>
              )}

              {amount && !isBuying && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-cyan-950/30 border border-cyan-900/30 text-cyan-400 text-xs">
                  <Package className="w-3.5 h-3.5 shrink-0" />
                  <span>Escrow sell — burns your {isYes ? 'YES' : 'NO'} tokens. Matched orders auto-merge to USDC.</span>
                </div>
              )}

              <Button
                onClick={handleTrade}
                disabled={!isConnected || !amount || isSubmitting || isSoothBookDataLoading || isCollateralizerLoading || !tickBook?.isActive || !hasEnoughBalance}
                className={cn(
                  "w-full py-4 text-lg font-bold uppercase tracking-wider rounded-xl transition-all",
                  action === 'buy_yes' && "bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 shadow-lg shadow-emerald-600/25",
                  action === 'buy_no' && "bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 shadow-lg shadow-rose-600/25",
                  (action === 'sell_yes' || action === 'sell_no') && "bg-gradient-to-r from-slate-600 to-slate-500 hover:from-slate-500 hover:to-slate-400 shadow-lg shadow-slate-600/25",
                  (!isConnected || !amount || isSubmitting || isSoothBookDataLoading || isCollateralizerLoading || !tickBook?.isActive || !hasEnoughBalance) && "opacity-50 cursor-not-allowed"
                )}
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                ) : !isConnected ? (
                  'Connect Wallet'
                ) : (isSoothBookDataLoading || isCollateralizerLoading || !tickBook) ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Initializing...
                  </span>
                ) : !tickBook.isActive ? (
                  'SoothBook Not Active'
                ) : !amount ? (
                  'Enter Amount'
                ) : (
                  `${isBuying ? 'Buy' : 'Sell'} ${isYes ? 'YES' : 'NO'} ${isBuying ? 'with' : 'for'} $${estimatedValue.toFixed(2)}`
                )}
              </Button>
            </div>
          </div>

          <Card className="bg-gradient-to-b from-slate-900/80 to-slate-950/80 border-slate-800/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Package className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-bold text-white">Mint / Merge</span>
            </div>
            <div className="flex gap-2 p-1 bg-slate-950/50 rounded-xl mb-3">
              <button
                onClick={() => { setMintMergeTab('mint'); setMintMergeAmount(''); }}
                className={cn(
                  "flex-1 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-all border-2",
                  mintMergeTab === 'mint'
                    ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/50"
                    : "bg-transparent text-slate-500 border-transparent hover:text-slate-300"
                )}
              >
                Mint
              </button>
              <button
                onClick={() => { setMintMergeTab('merge'); setMintMergeAmount(''); }}
                className={cn(
                  "flex-1 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-all border-2",
                  mintMergeTab === 'merge'
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/50"
                    : "bg-transparent text-slate-500 border-transparent hover:text-slate-300"
                )}
              >
                Merge
              </button>
            </div>
            <div className="space-y-3">
              <div className="relative">
                <input
                  type="number"
                  placeholder={mintMergeTab === 'mint' ? 'USDC amount' : 'Shares to merge'}
                  value={mintMergeAmount}
                  onChange={(e) => setMintMergeAmount(e.target.value)}
                  className="w-full px-3 py-2 pr-14 bg-slate-950 border border-slate-700 rounded-lg text-sm font-mono font-bold focus:border-slate-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (mintMergeTab === 'merge') {
                      const max = Math.min(userYesShares || 0, userNoShares || 0);
                      setMintMergeAmount(max > 0 ? max.toFixed(2) : '');
                    } else {
                      const usdcNum = Number(formatUnits(walletUsdc, decimals));
                      setMintMergeAmount(usdcNum > 0 ? usdcNum.toFixed(2) : '');
                    }
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition-colors"
                >
                  Max
                </button>
              </div>
              <div className="text-xs text-slate-500">
                {mintMergeTab === 'mint'
                  ? `Deposit ${mintMergeDisplayAmount} USDC → receive ${mintMergeDisplayAmount} YES + ${mintMergeDisplayAmount} NO`
                  : `Burn ${mintMergeDisplayAmount} YES + ${mintMergeDisplayAmount} NO → receive ${mintMergeDisplayAmount} USDC`
                }
              </div>
              <Button
                onClick={handleMintMerge}
                disabled={!isConnected || !mintMergeAmount || isSubmitting}
                className={cn(
                  "w-full py-2 text-sm font-bold uppercase rounded-lg transition-all",
                  mintMergeTab === 'mint'
                    ? "bg-cyan-600 hover:bg-cyan-500 text-white"
                    : "bg-amber-600 hover:bg-amber-500 text-white",
                  (!isConnected || !mintMergeAmount || isSubmitting) && "opacity-50 cursor-not-allowed"
                )}
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : mintMergeTab === 'mint' ? 'Mint Shares' : 'Merge Shares'}
              </Button>
            </div>
          </Card>

        </div>
      </div>
    </div>
  );
};

export default Pro;
