import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWriteContract,
} from 'wagmi';
import { encodePacked, formatUnits, keccak256, parseAbiItem, parseUnits } from 'viem';
import toast from 'react-hot-toast';
import { MarketHeader } from '../components/features/MarketHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ERC20_ABI, SOOTHBOOK_ABI } from '../config/abis';
import deployments from '../config/deployments.json';
import { useOnChainMarkets } from '../hooks/useOnChainMarkets';
import { useSoothBookMarket } from '../hooks/useSoothBook';

const BASE_SEPOLIA = 84532;
const BOOK_WINDOW = 22;

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'sports', label: 'Sports' },
  { id: 'cultures', label: 'Cultures' },
  { id: 'others', label: 'Others' },
] as const;

const STAGES = [
  { id: 'all', label: 'All' },
  { id: 'live', label: 'Live' },
  { id: 'settled', label: 'Settled' },
  { id: 'finalized', label: 'Finalized' },
] as const;

type DeploymentNetwork = {
  chainId?: number;
  contracts?: Record<string, string>;
  markets?: Array<{ name: string; marketKey: string; yesToken: string; noToken: string }>;
};

type Stage = 'bonding' | 'live' | 'settled' | 'finalized' | 'dismissed';

type ProMarket = {
  address?: `0x${string}`;
  name: string;
  symbol?: string;
  creator?: `0x${string}`;
  category: string;
  stage: Stage;
  isGraduated: boolean;
  isSettled: boolean;
  isFinalized: boolean;
  isDismissed: boolean;
  createdAt?: bigint;
  marketKey: `0x${string}`;
};

type BookRow = {
  tick: number;
  yesAmount: bigint;
  yesCount: bigint;
  noAmount: bigint;
  noCount: bigint;
};

type FeedItem = {
  id: string;
  type: 'placed' | 'filled' | 'cancelled';
  sideLabel: string;
  tickLabel: string;
  amount: bigint;
  account: `0x${string}`;
  block: bigint;
};

type MarketMeta = {
  category?: string;
  name?: string;
};

const getNetwork = (): DeploymentNetwork | undefined =>
  Object.values(deployments.networks as Record<string, DeploymentNetwork>).find(
    (network) => network.chainId === BASE_SEPOLIA,
  );

const network = getNetwork();
const SOOTHBOOK_ADDRESS = network?.contracts?.SoothBook as `0x${string}` | undefined;
const USDC_ADDRESS = network?.contracts?.MockUSDC as `0x${string}` | undefined;
const STATIC_MARKETS: ProMarket[] = (network?.markets ?? []).map((market) => ({
  name: market.name,
  category: 'others',
  stage: 'live',
  isGraduated: true,
  isSettled: false,
  isFinalized: false,
  isDismissed: false,
  marketKey: market.marketKey as `0x${string}`,
}));

const ORDER_PLACED_EVENT = parseAbiItem(
  'event OrderPlaced(bytes32 indexed marketKey, uint8 side, uint16 tick, address indexed maker, uint128 amount, bool escrow)',
);
const ORDER_FILLED_EVENT = parseAbiItem(
  'event OrderFilled(bytes32 indexed marketKey, uint8 takerSide, uint16 yesTick, uint16 noTick, address indexed taker, address indexed maker, uint128 amount, uint256 surplus)',
);
const ORDER_CANCELLED_EVENT = parseAbiItem(
  'event OrderCancelled(bytes32 indexed marketKey, uint8 side, uint16 tick, address indexed maker, uint128 amount)',
);

const explorerUrl = (segment: 'tx' | 'address', value: string) =>
  `https://sepolia.basescan.org/${segment}/${value}`;

const fmt = (value: bigint | undefined, decimals = 18, digits = 4) => {
  if (value === undefined) return '—';
  return Number(formatUnits(value, decimals)).toFixed(digits);
};

const shortAddr = (value: string) => `${value.slice(0, 6)}...${value.slice(-4)}`;

const parseAmt = (raw: string, decimals: number): bigint | null => {
  if (!raw || Number(raw) <= 0) return null;
  try {
    return parseUnits(raw, decimals);
  } catch {
    return null;
  }
};

const parseMarketMeta = (raw: string | null): MarketMeta | null => {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const record = parsed as Record<string, unknown>;
    const category = typeof record.category === 'string' ? record.category : undefined;
    const name = typeof record.name === 'string' ? record.name : undefined;
    return { category, name };
  } catch {
    return null;
  }
};

const formatStage = (stage: Stage) => {
  if (stage === 'dismissed') return 'Dismissed';
  return stage.charAt(0).toUpperCase() + stage.slice(1);
};

const stageBadgeVariant = (stage: Stage) => {
  if (stage === 'live') return 'success';
  if (stage === 'settled') return 'warning';
  if (stage === 'finalized') return 'secondary';
  if (stage === 'dismissed') return 'danger';
  return 'default';
};

export const Pro = () => {
  const { marketId } = useParams<{ marketId?: string }>();
  const { address: user, isConnected, chainId: walletChain } = useAccount();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const { markets: onChainMarkets, isLoading: isLoadingOnChainMarkets } = useOnChainMarkets();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [stage, setStage] = useState<string>('all');
  const [selectedMarketKey, setSelectedMarketKey] = useState<string | null>(null);
  const [outcomeTab, setOutcomeTab] = useState<'yes' | 'no'>('yes');
  const [tradeMode, setTradeMode] = useState<'buy' | 'sell'>('buy');
  const [priceInput, setPriceInput] = useState('50.0');
  const [sharesInput, setSharesInput] = useState('1');
  const [maxCostInput, setMaxCostInput] = useState('0');
  const [mintMergeInput, setMintMergeInput] = useState('1');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const [bookRows, setBookRows] = useState<BookRow[]>([]);
  const [isBookLoading, setIsBookLoading] = useState(false);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [isFeedLoading, setIsFeedLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const graduatedMarkets = useMemo<ProMarket[]>(() => {
    const discovered: ProMarket[] = onChainMarkets
      .filter((market) => market.isGraduated)
      .map((market) => {
        const meta = parseMarketMeta(localStorage.getItem(`market_meta_${market.address.toLowerCase()}`));
        return {
          address: market.address,
          name: meta?.name ?? market.name ?? shortAddr(market.address),
          symbol: market.symbol,
          creator: market.creator,
          category: (meta?.category ?? 'others').toLowerCase(),
          stage: market.stage,
          isGraduated: market.isGraduated,
          isSettled: market.isSettled,
          isFinalized: market.isFinalized,
          isDismissed: market.isDismissed,
          createdAt: market.createdAt,
          marketKey: keccak256(encodePacked(['address'], [market.address])),
        };
      });

    const merged = [...STATIC_MARKETS];
    const seen = new Set(merged.map((market) => market.marketKey.toLowerCase()));
    for (const discoveredMarket of discovered) {
      if (!seen.has(discoveredMarket.marketKey.toLowerCase())) {
        merged.push(discoveredMarket);
        seen.add(discoveredMarket.marketKey.toLowerCase());
      }
    }
    return merged;
  }, [onChainMarkets]);

  const categoriesWithCounts = useMemo(
    () =>
      CATEGORIES.map((entry) => ({
        ...entry,
        count:
          entry.id === 'all'
            ? graduatedMarkets.length
            : graduatedMarkets.filter((market) => market.category === entry.id).length,
      })),
    [graduatedMarkets],
  );

  const stagesWithCounts = useMemo(
    () =>
      STAGES.map((entry) => ({
        ...entry,
        count:
          entry.id === 'all'
            ? graduatedMarkets.length
            : graduatedMarkets.filter((market) => market.stage === entry.id).length,
      })),
    [graduatedMarkets],
  );

  const filteredMarkets = useMemo(() => {
    const q = search.toLowerCase().trim();
    return graduatedMarkets.filter((market) => {
      const matchesSearch =
        q.length === 0 ||
        market.name.toLowerCase().includes(q) ||
        market.symbol?.toLowerCase().includes(q) === true;
      const matchesCategory = category === 'all' || market.category === category;
      const matchesStage = stage === 'all' || market.stage === stage;
      return matchesSearch && matchesCategory && matchesStage;
    });
  }, [category, graduatedMarkets, search, stage]);

  useEffect(() => {
    if (filteredMarkets.length === 0) {
      setSelectedMarketKey(null);
      return;
    }
    const marketIdLower = marketId?.toLowerCase();
    if (marketIdLower) {
      const fromUrl = filteredMarkets.find(
        (market) =>
          market.marketKey.toLowerCase() === marketIdLower ||
          market.address?.toLowerCase() === marketIdLower,
      );
      if (fromUrl) {
        setSelectedMarketKey(fromUrl.marketKey);
        return;
      }
    }
    if (
      selectedMarketKey &&
      filteredMarkets.some((market) => market.marketKey.toLowerCase() === selectedMarketKey.toLowerCase())
    ) {
      return;
    }
    setSelectedMarketKey(filteredMarkets[0].marketKey);
  }, [filteredMarkets, marketId, selectedMarketKey]);

  const selectedMarket = useMemo(() => {
    if (filteredMarkets.length === 0) return null;
    if (!selectedMarketKey) return filteredMarkets[0];
    return (
      filteredMarkets.find(
        (market) => market.marketKey.toLowerCase() === selectedMarketKey.toLowerCase(),
      ) ?? filteredMarkets[0]
    );
  }, [filteredMarkets, selectedMarketKey]);

  const marketKey = selectedMarket?.marketKey;
  const canRead = !!SOOTHBOOK_ADDRESS && !!marketKey;
  const isWrongNetwork = walletChain !== BASE_SEPOLIA;

  const parsedPrice = Number(priceInput);
  const tick = Math.max(
    1,
    Math.min(999, Number.isFinite(parsedPrice) ? Math.round(parsedPrice * 10) : 500),
  );
  const sharesWad = parseAmt(sharesInput, 18);
  const mintMergeAmt = parseAmt(mintMergeInput, 6);
  const maxCostAmt = parseAmt(maxCostInput, 6) ?? 0n;

  const sharesFloat = Number(sharesInput);
  const shareValue = Number.isFinite(sharesFloat) && sharesFloat > 0 ? sharesFloat : 0;
  const estimatedCost = (shareValue * tick) / 1000;
  const potentialReturn = shareValue - estimatedCost;

  const tradeConfig = useMemo(() => {
    if (outcomeTab === 'yes' && tradeMode === 'buy') {
      return { fn: 'buyYes', escrow: false, label: 'Buy YES', color: 'success' as const };
    }
    if (outcomeTab === 'yes' && tradeMode === 'sell') {
      return { fn: 'buyNo', escrow: true, label: 'Sell YES', color: 'success' as const };
    }
    if (outcomeTab === 'no' && tradeMode === 'buy') {
      return { fn: 'buyNo', escrow: false, label: 'Buy NO', color: 'danger' as const };
    }
    return { fn: 'buyYes', escrow: true, label: 'Sell NO', color: 'danger' as const };
  }, [outcomeTab, tradeMode]);

  const { marketState, prices, backing } = useSoothBookMarket(SOOTHBOOK_ADDRESS, marketKey);

  const { data: usdcBalData = 0n } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: user ? [user] : undefined,
    query: { enabled: !!user && !!USDC_ADDRESS },
  });
  const { data: allowanceData = 0n } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: user && SOOTHBOOK_ADDRESS ? [user, SOOTHBOOK_ADDRESS] : undefined,
    query: { enabled: !!user && !!USDC_ADDRESS && !!SOOTHBOOK_ADDRESS },
  });
  const { data: yesBalData = 0n } = useReadContract({
    address: marketState.yesToken,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: user ? [user] : undefined,
    query: { enabled: !!user && !!marketState.yesToken },
  });
  const { data: noBalData = 0n } = useReadContract({
    address: marketState.noToken,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: user ? [user] : undefined,
    query: { enabled: !!user && !!marketState.noToken },
  });

  const usdcBalance = usdcBalData as bigint;
  const allowance = allowanceData as bigint;
  const yesBalance = yesBalData as bigint;
  const noBalance = noBalData as bigint;

  const ensureNetwork = async () => {
    if (!isWrongNetwork) return true;
    if (!switchChainAsync) {
      toast.error('Wallet cannot switch automatically');
      return false;
    }
    try {
      const result = await switchChainAsync({ chainId: BASE_SEPOLIA });
      return result.id === BASE_SEPOLIA;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Switch to Base Sepolia';
      toast.error(message);
      return false;
    }
  };

  const refreshBook = useCallback(async () => {
    if (!publicClient || !SOOTHBOOK_ADDRESS || !marketKey) return;
    setIsBookLoading(true);
    try {
      const bestYes = prices.bestYesTick ?? 500;
      const bestNo = prices.bestNoTick ?? 500;
      const centerTick = Math.round((bestYes + (1000 - bestNo)) / 2) || 500;
      const minTick = Math.max(1, centerTick - BOOK_WINDOW);
      const maxTick = Math.min(999, centerTick + BOOK_WINDOW);

      const calls: Array<{
        address: `0x${string}`;
        abi: typeof SOOTHBOOK_ABI;
        functionName: 'getOrdersAtTick';
        args: readonly [`0x${string}`, number, number];
      }> = [];

      for (let currentTick = minTick; currentTick <= maxTick; currentTick += 1) {
        calls.push({
          address: SOOTHBOOK_ADDRESS,
          abi: SOOTHBOOK_ABI,
          functionName: 'getOrdersAtTick',
          args: [marketKey, 1, currentTick],
        });
        calls.push({
          address: SOOTHBOOK_ADDRESS,
          abi: SOOTHBOOK_ABI,
          functionName: 'getOrdersAtTick',
          args: [marketKey, 0, currentTick],
        });
      }

      const result = await publicClient.multicall({ contracts: calls });
      const nextRows: BookRow[] = [];
      let idx = 0;

      for (let currentTick = minTick; currentTick <= maxTick; currentTick += 1) {
        const yesResult = result[idx];
        idx += 1;
        const noResult = result[idx];
        idx += 1;

        const yesTuple =
          yesResult.status === 'success'
            ? (yesResult.result as readonly [bigint, bigint])
            : ([0n, 0n] as const);
        const noTuple =
          noResult.status === 'success'
            ? (noResult.result as readonly [bigint, bigint])
            : ([0n, 0n] as const);

        nextRows.push({
          tick: currentTick,
          yesAmount: yesTuple[0],
          yesCount: yesTuple[1],
          noAmount: noTuple[0],
          noCount: noTuple[1],
        });
      }

      setBookRows(nextRows);
    } catch {
      toast.error('Failed to load orderbook');
    } finally {
      setIsBookLoading(false);
    }
  }, [marketKey, prices.bestNoTick, prices.bestYesTick, publicClient]);

  const refreshFeed = useCallback(async () => {
    if (!publicClient || !SOOTHBOOK_ADDRESS || !marketKey) return;
    setIsFeedLoading(true);
    try {
      const latest = await publicClient.getBlockNumber();
      const from = latest > 50000n ? latest - 50000n : 0n;
      const [placed, filled, cancelled] = await Promise.all([
        publicClient.getLogs({
          address: SOOTHBOOK_ADDRESS,
          event: ORDER_PLACED_EVENT,
          args: { marketKey },
          fromBlock: from,
          toBlock: 'latest',
        }),
        publicClient.getLogs({
          address: SOOTHBOOK_ADDRESS,
          event: ORDER_FILLED_EVENT,
          args: { marketKey },
          fromBlock: from,
          toBlock: 'latest',
        }),
        publicClient.getLogs({
          address: SOOTHBOOK_ADDRESS,
          event: ORDER_CANCELLED_EVENT,
          args: { marketKey },
          fromBlock: from,
          toBlock: 'latest',
        }),
      ]);

      const items: FeedItem[] = [];
      for (const log of placed) {
        items.push({
          id: `${log.transactionHash}-${log.logIndex}-p`,
          type: 'placed',
          sideLabel: Number(log.args.side) === 1 ? 'YES' : 'NO',
          tickLabel: String(log.args.tick),
          amount: log.args.amount ?? 0n,
          account: log.args.maker as `0x${string}`,
          block: log.blockNumber ?? 0n,
        });
      }
      for (const log of filled) {
        items.push({
          id: `${log.transactionHash}-${log.logIndex}-f`,
          type: 'filled',
          sideLabel: Number(log.args.takerSide) === 1 ? 'YES taker' : 'NO taker',
          tickLabel: `${log.args.yesTick}/${log.args.noTick}`,
          amount: log.args.amount ?? 0n,
          account: log.args.taker as `0x${string}`,
          block: log.blockNumber ?? 0n,
        });
      }
      for (const log of cancelled) {
        items.push({
          id: `${log.transactionHash}-${log.logIndex}-c`,
          type: 'cancelled',
          sideLabel: Number(log.args.side) === 1 ? 'YES' : 'NO',
          tickLabel: String(log.args.tick),
          amount: log.args.amount ?? 0n,
          account: log.args.maker as `0x${string}`,
          block: log.blockNumber ?? 0n,
        });
      }

      items.sort((a, b) => (a.block > b.block ? -1 : a.block < b.block ? 1 : 0));
      setFeed(items.slice(0, 50));
    } catch {
      toast.error('Failed to load activity');
    } finally {
      setIsFeedLoading(false);
    }
  }, [marketKey, publicClient]);

  const exec = async (
    label: string,
    fn: string,
    args: readonly unknown[],
    targetAddress?: `0x${string}`,
    abi?: typeof SOOTHBOOK_ABI | typeof ERC20_ABI,
  ) => {
    if (!isConnected || !user) {
      toast.error('Connect wallet');
      return;
    }
    if (!(await ensureNetwork())) return;

    const contractAddress = targetAddress ?? SOOTHBOOK_ADDRESS;
    const contractAbi = abi ?? SOOTHBOOK_ABI;

    if (!contractAddress) {
      toast.error('Missing contract');
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading(label);
    try {
      if (publicClient) {
        await publicClient.simulateContract({
          account: user,
          address: contractAddress,
          abi: contractAbi,
          functionName: fn as never,
          args: args as never,
        });
      }
      const hash = await writeContractAsync({
        address: contractAddress,
        abi: contractAbi,
        functionName: fn as never,
        args: args as never,
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }
      setLastTx(hash);
      toast.success('Confirmed', { id: toastId });
      void refreshBook();
      void refreshFeed();
    } catch (error: unknown) {
      const err = error as { shortMessage?: string; message?: string };
      toast.error(err.shortMessage ?? err.message ?? 'Transaction failed', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!canRead || !publicClient || isWrongNetwork) return;
    void refreshBook();
    void refreshFeed();
  }, [canRead, isWrongNetwork, publicClient, refreshBook, refreshFeed]);

  const spreadTick = useMemo(() => {
    const bestYes = prices.bestYesTick ?? 500;
    const bestNo = prices.bestNoTick ?? 500;
    return Math.round((bestYes + (1000 - bestNo)) / 2);
  }, [prices.bestNoTick, prices.bestYesTick]);

  const maxDepth = useMemo(() => {
    let max = 0;
    for (const row of bookRows) {
      const yes = Number(formatUnits(row.yesAmount, 18));
      const no = Number(formatUnits(row.noAmount, 18));
      if (yes > max) max = yes;
      if (no > max) max = no;
    }
    return max;
  }, [bookRows]);

  const yesPct = prices.yesPrice ? (Number(formatUnits(prices.yesPrice, 18)) * 100).toFixed(1) : '—';
  const noPct = prices.noPrice ? (Number(formatUnits(prices.noPrice, 18)) * 100).toFixed(1) : '—';

  const selectedStageBadge = selectedMarket ? stageBadgeVariant(selectedMarket.stage) : 'default';

  const scrollMarkets = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -320 : 320,
      behavior: 'smooth',
    });
  };

  if (!SOOTHBOOK_ADDRESS) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-slate-400">
        No SoothBook deployment configured for this network.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <MarketHeader
        title="Pro Trading"
        hint="SoothBook orderbook with 1000 price ticks. Place limit orders, mint/merge complete sets. Available for graduated markets."
        search={search}
        onSearchChange={setSearch}
        category={category}
        onCategoryChange={setCategory}
        categories={categoriesWithCounts}
        stage={stage}
        onStageChange={setStage}
        stages={stagesWithCounts}
        marketCount={filteredMarkets.length}
      />

      {isLoadingOnChainMarkets && graduatedMarkets.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
          <Loader2 className="size-4 animate-spin" /> Discovering graduated markets...
        </div>
      ) : filteredMarkets.length === 0 ? (
        <div className="flex items-center justify-center py-10 text-sm text-slate-500">
          No graduated markets match current filters.
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => scrollMarkets('left')}
            className="flex size-10 items-center justify-center rounded-full border border-slate-700 bg-slate-900/90 text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-200"
            aria-label="Scroll markets left"
          >
            <ChevronLeft className="size-5" />
          </button>
          <div
            ref={scrollRef}
            className="flex flex-1 gap-3 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {filteredMarkets.map((market) => (
              <button
                key={market.marketKey}
                type="button"
                onClick={() => setSelectedMarketKey(market.marketKey)}
                className={`flex w-[320px] flex-shrink-0 items-center gap-3 rounded-xl border px-4 py-2.5 text-left transition-all ${
                  selectedMarket?.marketKey === market.marketKey
                    ? 'border-cyan-500/50 bg-cyan-500/10 shadow-lg shadow-cyan-500/10'
                    : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-white">{market.name}</div>
                  <div className="text-[11px] text-slate-500">{market.symbol ?? market.marketKey.slice(0, 10)}</div>
                </div>
                <Badge variant={stageBadgeVariant(market.stage)}>{formatStage(market.stage)}</Badge>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => scrollMarkets('right')}
            className="flex size-10 items-center justify-center rounded-full border border-slate-700 bg-slate-900/90 text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-200"
            aria-label="Scroll markets right"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      )}

      {selectedMarket && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="!p-3 text-center">
              <div className="mb-1 text-[11px] uppercase text-slate-500">YES price</div>
              <div className="text-lg font-semibold text-emerald-300">{yesPct}%</div>
              <div className="text-[11px] text-slate-500">tick {String(prices.bestYesTick ?? '—')}</div>
            </Card>
            <Card className="!p-3 text-center">
              <div className="mb-1 text-[11px] uppercase text-slate-500">NO price</div>
              <div className="text-lg font-semibold text-rose-300">{noPct}%</div>
              <div className="text-[11px] text-slate-500">tick {String(prices.bestNoTick ?? '—')}</div>
            </Card>
            <Card className="!p-3 text-center">
              <div className="mb-1 text-[11px] uppercase text-slate-500">Backing</div>
              <div className="text-lg font-semibold text-white">{fmt(backing, 6, 2)}</div>
              <div className="text-[11px] text-slate-500">USDC collateral</div>
            </Card>
            <Card className="!p-3 text-center">
              <div className="mb-1 text-[11px] uppercase text-slate-500">Stage</div>
              <div className="text-sm font-semibold text-white">{formatStage(selectedMarket.stage)}</div>
              <div className="mt-1">
                <Badge variant={selectedStageBadge}>{marketState.isFinalized ? 'Resolved' : 'Live book'}</Badge>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-10">
            <div className="space-y-4 lg:col-span-6">
              <Card className="!p-0 overflow-hidden bg-slate-950/80">
                <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Orderbook depth</h3>
                    <p className="text-xs text-slate-500">YES and NO liquidity around current spread</p>
                  </div>
                  <Button size="xs" variant="ghost" onClick={() => void refreshBook()} disabled={isBookLoading}>
                    {isBookLoading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                  </Button>
                </div>

                <div className="grid grid-cols-[1fr_120px_1fr] border-b border-slate-800 bg-slate-900/70 px-3 py-2 text-[11px] uppercase text-slate-500">
                  <div className="text-right">YES depth</div>
                  <div className="text-center">Price (c)</div>
                  <div>NO depth</div>
                </div>

                <div className="max-h-[520px] overflow-auto">
                  {bookRows.length === 0 ? (
                    <div className="px-4 py-10 text-center text-xs text-slate-500">
                      {isBookLoading ? 'Loading depth...' : 'No depth available'}
                    </div>
                  ) : (
                    bookRows.map((row) => {
                      const yesDepth = Number(formatUnits(row.yesAmount, 18));
                      const noDepth = Number(formatUnits(row.noAmount, 18));
                      const yesWidth = maxDepth > 0 ? (yesDepth / maxDepth) * 100 : 0;
                      const noWidth = maxDepth > 0 ? (noDepth / maxDepth) * 100 : 0;
                      const isSpreadRow = row.tick === spreadTick;

                      return (
                        <div
                          key={row.tick}
                          className={`grid grid-cols-[1fr_120px_1fr] border-b border-slate-900/80 text-xs font-mono ${
                            isSpreadRow ? 'bg-cyan-500/8' : 'bg-slate-950/50'
                          }`}
                        >
                          <div className="relative flex h-8 items-center justify-end px-2">
                            <div
                              className="absolute right-1 top-1/2 h-6 -translate-y-1/2 rounded bg-emerald-500/20"
                              style={{ width: `${yesWidth}%` }}
                            />
                            <span className="relative z-10 text-emerald-300">
                              {row.yesAmount > 0n ? fmt(row.yesAmount, 18, 2) : ''}
                            </span>
                            <span className="relative z-10 ml-1 text-[10px] text-slate-600">
                              {row.yesCount > 0n ? `(${row.yesCount.toString()})` : ''}
                            </span>
                          </div>

                          <div className="flex h-8 items-center justify-center border-x border-slate-900 text-slate-300">
                            <span className={isSpreadRow ? 'text-cyan-300' : ''}>{(row.tick / 10).toFixed(1)}</span>
                            {isSpreadRow && <span className="ml-1 text-[10px] text-cyan-400">spread</span>}
                          </div>

                          <div className="relative flex h-8 items-center px-2">
                            <div
                              className="absolute left-1 top-1/2 h-6 -translate-y-1/2 rounded bg-rose-500/20"
                              style={{ width: `${noWidth}%` }}
                            />
                            <span className="relative z-10 text-rose-300">
                              {row.noAmount > 0n ? fmt(row.noAmount, 18, 2) : ''}
                            </span>
                            <span className="relative z-10 ml-1 text-[10px] text-slate-600">
                              {row.noCount > 0n ? `(${row.noCount.toString()})` : ''}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </Card>
            </div>

            <div className="space-y-4 lg:col-span-4">
              <Card className="!p-4 space-y-4 bg-slate-950/80">
                <div className="flex items-center justify-between">
                  <div className="text-xs uppercase text-slate-500">Trade panel</div>
                  {isWrongNetwork && (
                    <Button
                      size="xs"
                      variant="danger"
                      disabled={!isConnected || isSwitching}
                      onClick={() => switchChainAsync?.({ chainId: BASE_SEPOLIA })}
                    >
                      {isSwitching ? <Loader2 className="size-3.5 animate-spin" /> : 'Switch'}
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOutcomeTab('yes')}
                    className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                      outcomeTab === 'yes'
                        ? 'border-emerald-500/50 bg-emerald-500/12 text-emerald-300'
                        : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    YES
                  </button>
                  <button
                    type="button"
                    onClick={() => setOutcomeTab('no')}
                    className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                      outcomeTab === 'no'
                        ? 'border-rose-500/50 bg-rose-500/12 text-rose-300'
                        : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    NO
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-800 bg-slate-900/70 p-1">
                  <button
                    type="button"
                    onClick={() => setTradeMode('buy')}
                    className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                      tradeMode === 'buy' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Buy
                  </button>
                  <button
                    type="button"
                    onClick={() => setTradeMode('sell')}
                    className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                      tradeMode === 'sell' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Sell
                  </button>
                </div>

                <div className="space-y-2.5">
                  <label className="block">
                    <span className="text-[11px] text-slate-500">Price (cents)</span>
                    <input
                      value={priceInput}
                      onChange={(event) => setPriceInput(event.target.value)}
                      placeholder="50.0"
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none"
                    />
                    <div className="mt-1 text-[11px] text-slate-500">Tick: {tick} (0.1c precision)</div>
                  </label>
                  <label className="block">
                    <span className="text-[11px] text-slate-500">Shares</span>
                    <input
                      value={sharesInput}
                      onChange={(event) => setSharesInput(event.target.value)}
                      placeholder="1"
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] text-slate-500">Max cost (USDC, optional)</span>
                    <input
                      value={maxCostInput}
                      onChange={(event) => setMaxCostInput(event.target.value)}
                      placeholder="0"
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none"
                    />
                  </label>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 text-xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Estimated cost</span>
                    <span className="font-mono text-slate-200">{estimatedCost.toFixed(4)} USDC</span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-slate-400">
                    <span>Potential return</span>
                    <span className="font-mono text-slate-200">{potentialReturn.toFixed(4)} USDC</span>
                  </div>
                </div>

                <Button
                  className="w-full"
                  variant={tradeConfig.color}
                  disabled={!sharesWad || !canRead || isSubmitting}
                  onClick={() => {
                    if (!sharesWad || !marketKey) return;
                    void exec(`Submitting ${tradeConfig.label}...`, tradeConfig.fn, [
                      marketKey,
                      tick,
                      sharesWad,
                      tradeConfig.escrow,
                      maxCostAmt,
                    ]);
                  }}
                >
                  {isSubmitting ? <Loader2 className="mx-auto size-4 animate-spin" /> : `${tradeConfig.label} @ ${(tick / 10).toFixed(1)}c`}
                </Button>
              </Card>

              <Card className="!p-4 space-y-3">
                <div className="flex items-center gap-1.5 text-xs uppercase text-slate-500">
                  <ArrowDownUp className="size-3.5" /> Mint / Merge
                </div>
                <label className="block">
                  <span className="text-[11px] text-slate-500">Amount (USDC)</span>
                  <input
                    value={mintMergeInput}
                    onChange={(event) => setMintMergeInput(event.target.value)}
                    placeholder="1"
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none"
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant="info"
                    disabled={!mintMergeAmt || !marketKey || isSubmitting}
                    onClick={() => marketKey && mintMergeAmt && exec('Minting...', 'mint', [marketKey, mintMergeAmt])}
                  >
                    Mint Set
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!mintMergeAmt || !marketKey || isSubmitting}
                    onClick={() => marketKey && mintMergeAmt && exec('Merging...', 'merge', [marketKey, mintMergeAmt])}
                  >
                    Merge
                  </Button>
                </div>
                {marketState.isFinalized && (
                  <Button
                    size="sm"
                    variant="success"
                    className="w-full"
                    disabled={!marketKey || isSubmitting}
                    onClick={() => marketKey && exec('Redeeming...', 'redeem', [marketKey])}
                  >
                    Redeem Winnings
                  </Button>
                )}
              </Card>

              <Card className="!p-4 space-y-2">
                <div className="flex items-center gap-1.5 text-xs uppercase text-slate-500">
                  <Wallet className="size-3.5" /> Positions
                </div>
                {!isConnected ? (
                  <div className="text-xs text-slate-500">Connect wallet to see balances</div>
                ) : (
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between text-slate-300">
                      <span>USDC</span>
                      <span className="font-mono">{fmt(usdcBalance, 6, 2)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-300">
                      <span>YES tokens</span>
                      <span className="font-mono">{fmt(yesBalance, 18, 4)}</span>
                    </div>
                    <div className="flex justify-between text-rose-300">
                      <span>NO tokens</span>
                      <span className="font-mono">{fmt(noBalance, 18, 4)}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-800 pt-1 text-xs text-slate-400">
                      <span>Allowance</span>
                      <span className="font-mono">{fmt(allowance, 6, 2)} USDC</span>
                    </div>
                    <Button
                      size="xs"
                      variant="ghost"
                      className="mt-1 w-full"
                      disabled={!USDC_ADDRESS || !SOOTHBOOK_ADDRESS || isSubmitting}
                      onClick={() =>
                        USDC_ADDRESS &&
                        SOOTHBOOK_ADDRESS &&
                        exec(
                          'Approving...',
                          'approve',
                          [SOOTHBOOK_ADDRESS, parseUnits('100000', 6)],
                          USDC_ADDRESS,
                          ERC20_ABI,
                        )
                      }
                    >
                      Approve 100k USDC
                    </Button>
                  </div>
                )}
              </Card>

              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">
                <span>SoothBook</span>
                <a
                  href={explorerUrl('address', SOOTHBOOK_ADDRESS)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:text-white"
                >
                  View contract <ExternalLink className="size-3" />
                </a>
              </div>
            </div>
          </div>

          <Card className="!p-0 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <h3 className="text-sm font-semibold text-white">Recent Activity</h3>
              <Button size="xs" variant="ghost" onClick={() => void refreshFeed()} disabled={isFeedLoading}>
                {isFeedLoading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              </Button>
            </div>
            <div className="max-h-60 divide-y divide-slate-800/70 overflow-auto">
              {feed.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-slate-500">No activity yet</div>
              ) : (
                feed.map((item) => {
                  const mine = !!user && item.account.toLowerCase() === user.toLowerCase();
                  const tone =
                    item.type === 'filled'
                      ? 'text-cyan-400'
                      : item.type === 'cancelled'
                        ? 'text-amber-400'
                        : 'text-slate-300';

                  return (
                    <div key={item.id} className="flex items-center gap-4 px-4 py-2.5 font-mono text-xs">
                      <span className={`w-20 uppercase font-semibold ${tone}`}>{item.type}</span>
                      <span className="text-slate-400">{item.sideLabel}</span>
                      <span className="text-slate-500">@{item.tickLabel}</span>
                      <span className="flex-1 text-right text-slate-300">{fmt(item.amount, 18, 2)} shares</span>
                      <span className={mine ? 'text-emerald-300' : 'text-slate-600'}>
                        {mine ? 'You' : shortAddr(item.account)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          {lastTx && (
            <div className="text-center">
              <a
                href={explorerUrl('tx', lastTx)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-mono text-xs text-slate-400 hover:text-white"
              >
                Last tx: {lastTx.slice(0, 10)}...{lastTx.slice(-6)} <ExternalLink className="size-3" />
              </a>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Pro;
