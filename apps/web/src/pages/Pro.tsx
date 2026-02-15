/**
 * Pro Trading Page — SoothBook Orderbook Interface
 *
 * Production-grade trading UI for the SoothBook 4-atomic-action orderbook.
 * Markets loaded from deployments.json. Supports buyYes, buyNo, mint, merge, cancel, redeem.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  ArrowDownUp, ChevronDown, ExternalLink,
  Loader2, RefreshCw, Wallet,
} from 'lucide-react';
import {
  useAccount, useChainId, usePublicClient, useReadContract,
  useSwitchChain, useWriteContract,
} from 'wagmi';
import { formatUnits, parseAbiItem, parseUnits } from 'viem';
import toast from 'react-hot-toast';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ERC20_ABI, SOOTHBOOK_ABI } from '../config/abis';
import { useSoothBookMarket } from '../hooks/useSoothBook';
import deployments from '../config/deployments.json';

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const BASE_SEPOLIA = 84532;

type DeploymentNetwork = {
  chainId?: number;
  contracts?: Record<string, string>;
  markets?: Array<{ name: string; marketKey: string; yesToken: string; noToken: string }>;
};

const getNetwork = (): DeploymentNetwork | undefined =>
  Object.values(deployments.networks as Record<string, DeploymentNetwork>).find(
    (n) => n.chainId === BASE_SEPOLIA,
  );

const network = getNetwork();
const SOOTHBOOK_ADDRESS = network?.contracts?.SoothBook as `0x${string}` | undefined;
const USDC_ADDRESS = network?.contracts?.MockUSDC as `0x${string}` | undefined;
const MARKETS = network?.markets ?? [];

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

const shortAddr = (v: string) => `${v.slice(0, 6)}…${v.slice(-4)}`;

const parseAmt = (raw: string, decimals: number): bigint | null => {
  if (!raw || Number(raw) <= 0) return null;
  try { return parseUnits(raw, decimals); } catch { return null; }
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const Pro = () => {
  const { marketId } = useParams<{ marketId?: string }>();
  const { address: user, isConnected, chainId: walletChain } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  // --- Market selection ---
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    if (marketId) {
      const idx = MARKETS.findIndex((m) => m.marketKey.toLowerCase() === marketId.toLowerCase());
      if (idx >= 0) setSelectedIdx(idx);
    }
  }, [marketId]);

  const market = MARKETS[selectedIdx];
  const marketKey = market?.marketKey as `0x${string}` | undefined;

  // --- Trading form state ---
  const [tradeSide, setTradeSide] = useState<'yes' | 'no'>('yes');
  const [tickInput, setTickInput] = useState('500');
  const [sharesInput, setSharesInput] = useState('1');
  const [maxCostInput, setMaxCostInput] = useState('0');
  const [escrowExit, setEscrowExit] = useState(false);
  const [mintMergeInput, setMintMergeInput] = useState('1');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastTx, setLastTx] = useState<string | null>(null);

  // --- Orderbook state ---
  const [bookRows, setBookRows] = useState<BookRow[]>([]);
  const [isBookLoading, setIsBookLoading] = useState(false);
  const bookWindow = 20;

  // --- Activity feed ---
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [isFeedLoading, setIsFeedLoading] = useState(false);

  // --- Derived ---
  const isWrongNetwork = walletChain !== BASE_SEPOLIA;
  const canRead = !!SOOTHBOOK_ADDRESS && !!marketKey;
  const tick = Math.max(1, Math.min(999, Number(tickInput) || 500));
  const sharesWad = parseAmt(sharesInput, 18);
  const mintMergeAmt = parseAmt(mintMergeInput, 6);
  const maxCostAmt = parseAmt(maxCostInput, 6) ?? 0n;

  // --- On-chain reads ---
  const { marketState, prices, backing, isLoading: isMarketLoading } = useSoothBookMarket(
    SOOTHBOOK_ADDRESS, marketKey,
  );

  const { data: usdcBalData = 0n } = useReadContract({
    address: USDC_ADDRESS, abi: ERC20_ABI, functionName: 'balanceOf',
    args: user ? [user] : undefined,
    query: { enabled: !!user && !!USDC_ADDRESS },
  });
  const { data: allowanceData = 0n } = useReadContract({
    address: USDC_ADDRESS, abi: ERC20_ABI, functionName: 'allowance',
    args: user && SOOTHBOOK_ADDRESS ? [user, SOOTHBOOK_ADDRESS] : undefined,
    query: { enabled: !!user && !!USDC_ADDRESS && !!SOOTHBOOK_ADDRESS },
  });
  const { data: yesBalData = 0n } = useReadContract({
    address: marketState.yesToken, abi: ERC20_ABI, functionName: 'balanceOf',
    args: user ? [user] : undefined,
    query: { enabled: !!user && !!marketState.yesToken },
  });
  const { data: noBalData = 0n } = useReadContract({
    address: marketState.noToken, abi: ERC20_ABI, functionName: 'balanceOf',
    args: user ? [user] : undefined,
    query: { enabled: !!user && !!marketState.noToken },
  });

  const usdcBalance = usdcBalData as bigint;
  const allowance = allowanceData as bigint;
  const yesBalance = yesBalData as bigint;
  const noBalance = noBalData as bigint;

  // --- Network switch ---
  const ensureNetwork = async () => {
    if (!isWrongNetwork) return true;
    if (!switchChainAsync) { toast.error('Wallet cannot switch automatically'); return false; }
    try {
      const r = await switchChainAsync({ chainId: BASE_SEPOLIA });
      return r.id === BASE_SEPOLIA;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Switch to Base Sepolia';
      toast.error(msg);
      return false;
    }
  };

  // --- Contract write helper ---
  const exec = async (
    label: string, fn: string, args: readonly unknown[],
    addr?: `0x${string}`, abi?: typeof SOOTHBOOK_ABI | typeof ERC20_ABI,
  ) => {
    if (!isConnected || !user) { toast.error('Connect wallet'); return; }
    if (!(await ensureNetwork())) return;
    const target = addr ?? SOOTHBOOK_ADDRESS;
    const targetAbi = abi ?? SOOTHBOOK_ABI;
    if (!target) { toast.error('Missing contract'); return; }
    setIsSubmitting(true);
    const tid = toast.loading(label);
    try {
      if (publicClient) {
        await publicClient.simulateContract({
          account: user, address: target, abi: targetAbi,
          functionName: fn as never, args: args as never,
        });
      }
      const hash = await writeContractAsync({
        address: target, abi: targetAbi,
        functionName: fn as never, args: args as never,
      });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      setLastTx(hash);
      toast.success('Confirmed', { id: tid });
      void refreshBook();
      void refreshFeed();
    } catch (e: unknown) {
      const err = e as { shortMessage?: string; message?: string };
      toast.error(err.shortMessage ?? err.message ?? 'Transaction failed', { id: tid });
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Orderbook refresh ---
  const refreshBook = useCallback(async () => {
    if (!publicClient || !SOOTHBOOK_ADDRESS || !marketKey) return;
    setIsBookLoading(true);
    try {
      const bestYes = prices.bestYesTick ?? 500;
      const bestNo = prices.bestNoTick ?? 500;
      const center = Math.round((bestYes + (1000 - bestNo)) / 2) || 500;
      const lo = Math.max(1, center - bookWindow);
      const hi = Math.min(999, center + bookWindow);
      const calls: Array<{
        address: `0x${string}`; abi: typeof SOOTHBOOK_ABI;
        functionName: 'getOrdersAtTick'; args: readonly [`0x${string}`, number, number];
      }> = [];
      for (let t = lo; t <= hi; t++) {
        calls.push({ address: SOOTHBOOK_ADDRESS, abi: SOOTHBOOK_ABI, functionName: 'getOrdersAtTick', args: [marketKey, 1, t] });
        calls.push({ address: SOOTHBOOK_ADDRESS, abi: SOOTHBOOK_ABI, functionName: 'getOrdersAtTick', args: [marketKey, 0, t] });
      }
      const res = await publicClient.multicall({ contracts: calls });
      const rows: BookRow[] = [];
      let i = 0;
      for (let t = lo; t <= hi; t++) {
        const y = res[i++];
        const n = res[i++];
        const yt = y.status === 'success' ? (y.result as readonly [bigint, bigint]) : [0n, 0n] as const;
        const nt = n.status === 'success' ? (n.result as readonly [bigint, bigint]) : [0n, 0n] as const;
        rows.push({ tick: t, yesAmount: yt[0], yesCount: yt[1], noAmount: nt[0], noCount: nt[1] });
      }
      setBookRows(rows);
    } catch {
      toast.error('Failed to load orderbook');
    } finally {
      setIsBookLoading(false);
    }
  }, [publicClient, marketKey, prices.bestYesTick, prices.bestNoTick]);

  // --- Activity feed refresh ---
  const refreshFeed = useCallback(async () => {
    if (!publicClient || !SOOTHBOOK_ADDRESS || !marketKey) return;
    setIsFeedLoading(true);
    try {
      const latest = await publicClient.getBlockNumber();
      const from = latest > 50000n ? latest - 50000n : 0n;
      const [placed, filled, cancelled] = await Promise.all([
        publicClient.getLogs({ address: SOOTHBOOK_ADDRESS, event: ORDER_PLACED_EVENT, args: { marketKey }, fromBlock: from, toBlock: 'latest' }),
        publicClient.getLogs({ address: SOOTHBOOK_ADDRESS, event: ORDER_FILLED_EVENT, args: { marketKey }, fromBlock: from, toBlock: 'latest' }),
        publicClient.getLogs({ address: SOOTHBOOK_ADDRESS, event: ORDER_CANCELLED_EVENT, args: { marketKey }, fromBlock: from, toBlock: 'latest' }),
      ]);
      const items: FeedItem[] = [];
      for (const l of placed) items.push({ id: `${l.transactionHash}-${l.logIndex}-p`, type: 'placed', sideLabel: Number(l.args.side) === 1 ? 'YES' : 'NO', tickLabel: String(l.args.tick), amount: l.args.amount ?? 0n, account: l.args.maker as `0x${string}`, block: l.blockNumber ?? 0n });
      for (const l of filled) items.push({ id: `${l.transactionHash}-${l.logIndex}-f`, type: 'filled', sideLabel: Number(l.args.takerSide) === 1 ? 'YES taker' : 'NO taker', tickLabel: `${l.args.yesTick}/${l.args.noTick}`, amount: l.args.amount ?? 0n, account: l.args.taker as `0x${string}`, block: l.blockNumber ?? 0n });
      for (const l of cancelled) items.push({ id: `${l.transactionHash}-${l.logIndex}-c`, type: 'cancelled', sideLabel: Number(l.args.side) === 1 ? 'YES' : 'NO', tickLabel: String(l.args.tick), amount: l.args.amount ?? 0n, account: l.args.maker as `0x${string}`, block: l.blockNumber ?? 0n });
      items.sort((a, b) => (a.block > b.block ? -1 : a.block < b.block ? 1 : 0));
      setFeed(items.slice(0, 50));
    } catch {
      toast.error('Failed to load activity');
    } finally {
      setIsFeedLoading(false);
    }
  }, [publicClient, marketKey]);

  // Auto-load on market change
  useEffect(() => {
    if (!canRead || !publicClient || isWrongNetwork) return;
    void refreshBook();
    void refreshFeed();
  }, [canRead, publicClient, isWrongNetwork, refreshBook, refreshFeed]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!SOOTHBOOK_ADDRESS || MARKETS.length === 0) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400 text-sm">
        No SoothBook deployment configured for this network.
      </div>
    );
  }

  const { bestYesTick, bestNoTick, yesPrice, noPrice } = prices;
  const yesPct = yesPrice ? (Number(formatUnits(yesPrice, 18)) * 100).toFixed(1) : '—';
  const noPct = noPrice ? (Number(formatUnits(noPrice, 18)) * 100).toFixed(1) : '—';

  return (
    <div className="space-y-4">
      {/* ---- Top bar ---- */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Market selector */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900/80 hover:border-slate-600 transition-colors text-white text-sm font-medium min-w-[280px]"
          >
            <span className="truncate flex-1 text-left">{market?.name ?? 'Select market'}</span>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          {dropdownOpen && (
            <div className="absolute z-50 mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 shadow-xl overflow-hidden">
              {MARKETS.map((m, i) => (
                <button
                  key={m.marketKey}
                  onClick={() => { setSelectedIdx(i); setDropdownOpen(false); }}
                  className={`w-full text-left px-4 py-3 text-sm hover:bg-slate-800 transition-colors ${i === selectedIdx ? 'bg-cyan-500/10 text-cyan-300' : 'text-slate-200'}`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {isWrongNetwork && (
            <Button size="sm" variant="danger" onClick={() => switchChainAsync?.({ chainId: BASE_SEPOLIA })} disabled={!isConnected || isSwitching}>
              {isSwitching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Switch to Base Sepolia'}
            </Button>
          )}
          <Badge variant={marketState.isActive ? 'success' : marketState.isFinalized ? 'warning' : 'default'}>
            {marketState.isFinalized ? 'Resolved' : marketState.isActive ? 'Active' : 'Loading…'}
          </Badge>
          <a href={explorerUrl('address', SOOTHBOOK_ADDRESS)} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-slate-200">
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* ---- Price banner ---- */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="!p-3 text-center">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">YES Price</div>
          <div className="text-lg font-bold text-emerald-400">{yesPct}%</div>
          <div className="text-[11px] text-slate-500">tick {String(bestYesTick ?? '—')}</div>
        </Card>
        <Card className="!p-3 text-center">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">NO Price</div>
          <div className="text-lg font-bold text-rose-400">{noPct}%</div>
          <div className="text-[11px] text-slate-500">tick {String(bestNoTick ?? '—')}</div>
        </Card>
        <Card className="!p-3 text-center">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Backing</div>
          <div className="text-lg font-bold text-white">{fmt(backing as bigint | undefined, 6, 2)}</div>
          <div className="text-[11px] text-slate-500">USDC</div>
        </Card>
        <Card className="!p-3 text-center">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Status</div>
          <div className="text-lg font-bold text-white">{marketState.isFinalized ? ['NO', 'YES', 'INVALID'][marketState.outcome] : 'Trading'}</div>
          <div className="text-[11px] text-slate-500">{marketState.isFinalized ? 'Resolved' : 'Open'}</div>
        </Card>
      </div>

      {/* ---- Main grid ---- */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-4">
        {/* Left: Orderbook */}
        <div className="lg:col-span-6">
          <Card className="!p-0 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-white">Orderbook</h3>
              <Button size="xs" variant="ghost" onClick={() => void refreshBook()} disabled={isBookLoading}>
                {isBookLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              </Button>
            </div>
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full text-xs font-mono">
                <thead className="sticky top-0 bg-slate-950/95 text-slate-500 border-b border-slate-800">
                  <tr>
                    <th className="text-left px-3 py-2 w-16">Tick</th>
                    <th className="text-left px-3 py-2 w-20">Price</th>
                    <th className="text-right px-3 py-2">YES Depth</th>
                    <th className="text-right px-3 py-2">YES #</th>
                    <th className="text-right px-3 py-2">NO Depth</th>
                    <th className="text-right px-3 py-2">NO #</th>
                  </tr>
                </thead>
                <tbody>
                  {bookRows.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">{isBookLoading ? 'Loading…' : 'No data — click refresh'}</td></tr>
                  ) : bookRows.map((r) => {
                    const hasLiq = r.yesCount > 0n || r.noCount > 0n;
                    return (
                      <tr key={r.tick} className={hasLiq ? 'bg-slate-900/40' : ''}>
                        <td className="px-3 py-1.5 text-slate-300">{r.tick}</td>
                        <td className="px-3 py-1.5 text-slate-400">{(r.tick / 10).toFixed(1)}%</td>
                        <td className="px-3 py-1.5 text-right text-emerald-400">{r.yesAmount > 0n ? fmt(r.yesAmount, 18, 2) : ''}</td>
                        <td className="px-3 py-1.5 text-right text-slate-500">{r.yesCount > 0n ? r.yesCount.toString() : ''}</td>
                        <td className="px-3 py-1.5 text-right text-rose-400">{r.noAmount > 0n ? fmt(r.noAmount, 18, 2) : ''}</td>
                        <td className="px-3 py-1.5 text-right text-slate-500">{r.noCount > 0n ? r.noCount.toString() : ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Right: Trade panel + Positions */}
        <div className="lg:col-span-4 space-y-4">
          {/* Trade panel */}
          <Card className="!p-4 space-y-3">
            <div className="text-xs uppercase tracking-wider text-slate-500">Place Order</div>

            {/* Side tabs */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setTradeSide('yes')}
                className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${tradeSide === 'yes' ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-600'}`}
              >Buy YES</button>
              <button
                onClick={() => setTradeSide('no')}
                className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${tradeSide === 'no' ? 'border-rose-500/50 bg-rose-500/10 text-rose-300' : 'border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-600'}`}
              >Buy NO</button>
            </div>

            {/* Inputs */}
            <div className="space-y-2">
              <label className="block">
                <span className="text-[11px] text-slate-500">Tick (1–999) · {(tick / 10).toFixed(1)}% probability</span>
                <input value={tickInput} onChange={(e) => setTickInput(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-white focus:border-cyan-500/50 focus:outline-none" placeholder="500" />
              </label>
              <label className="block">
                <span className="text-[11px] text-slate-500">Shares (WAD)</span>
                <input value={sharesInput} onChange={(e) => setSharesInput(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-white focus:border-cyan-500/50 focus:outline-none" placeholder="1" />
              </label>
              <label className="block">
                <span className="text-[11px] text-slate-500">Max cost (USDC, 0 = no limit)</span>
                <input value={maxCostInput} onChange={(e) => setMaxCostInput(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-white focus:border-cyan-500/50 focus:outline-none" placeholder="0" />
              </label>
              <label className="inline-flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
                <input type="checkbox" checked={escrowExit} onChange={(e) => setEscrowExit(e.target.checked)} className="accent-cyan-500" />
                Escrow exit (lock opposite tokens)
              </label>
            </div>

            <Button
              className="w-full"
              variant={tradeSide === 'yes' ? 'success' : 'danger'}
              disabled={!sharesWad || !canRead || isSubmitting}
              onClick={() => {
                if (!sharesWad || !marketKey) return;
                const fn = tradeSide === 'yes' ? 'buyYes' : 'buyNo';
                void exec(`Placing ${tradeSide.toUpperCase()} order…`, fn, [marketKey, tick, sharesWad, escrowExit, maxCostAmt]);
              }}
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : `Buy ${tradeSide.toUpperCase()} @ ${(tick / 10).toFixed(1)}%`}
            </Button>
          </Card>

          {/* Mint / Merge */}
          <Card className="!p-4 space-y-3">
            <div className="text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <ArrowDownUp className="w-3.5 h-3.5" /> Mint / Merge
            </div>
            <label className="block">
              <span className="text-[11px] text-slate-500">Amount (USDC)</span>
              <input value={mintMergeInput} onChange={(e) => setMintMergeInput(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-white focus:border-cyan-500/50 focus:outline-none" placeholder="1" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" variant="info" disabled={!mintMergeAmt || !marketKey || isSubmitting} onClick={() => marketKey && mintMergeAmt && exec('Minting…', 'mint', [marketKey, mintMergeAmt])}>
                Mint Set
              </Button>
              <Button size="sm" variant="secondary" disabled={!mintMergeAmt || !marketKey || isSubmitting} onClick={() => marketKey && mintMergeAmt && exec('Merging…', 'merge', [marketKey, mintMergeAmt])}>
                Merge
              </Button>
            </div>
            {marketState.isFinalized && (
              <Button size="sm" variant="success" className="w-full" disabled={!marketKey || isSubmitting} onClick={() => marketKey && exec('Redeeming…', 'redeem', [marketKey])}>
                Redeem Winnings
              </Button>
            )}
          </Card>

          {/* Wallet / Positions */}
          <Card className="!p-4 space-y-2">
            <div className="text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5" /> Positions
            </div>
            {!isConnected ? (
              <div className="text-xs text-slate-500">Connect wallet to see positions</div>
            ) : (
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-slate-300">
                  <span>USDC</span>
                  <span className="font-mono">{fmt(usdcBalance, 6, 2)}</span>
                </div>
                <div className="flex justify-between text-emerald-400">
                  <span>YES tokens</span>
                  <span className="font-mono">{fmt(yesBalance, 18, 4)}</span>
                </div>
                <div className="flex justify-between text-rose-400">
                  <span>NO tokens</span>
                  <span className="font-mono">{fmt(noBalance, 18, 4)}</span>
                </div>
                <div className="flex justify-between text-slate-400 text-xs pt-1 border-t border-slate-800">
                  <span>Allowance</span>
                  <span className="font-mono">{fmt(allowance, 6, 2)} USDC</span>
                </div>
                <Button
                  size="xs" variant="ghost" className="w-full mt-1"
                  disabled={!USDC_ADDRESS || !SOOTHBOOK_ADDRESS || isSubmitting}
                  onClick={() => USDC_ADDRESS && SOOTHBOOK_ADDRESS && exec('Approving…', 'approve', [SOOTHBOOK_ADDRESS, parseUnits('100000', 6)], USDC_ADDRESS, ERC20_ABI)}
                >
                  Approve 100k USDC
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ---- Activity Feed ---- */}
      <Card className="!p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <h3 className="text-sm font-semibold text-white">Recent Activity</h3>
          <Button size="xs" variant="ghost" onClick={() => void refreshFeed()} disabled={isFeedLoading}>
            {isFeedLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          </Button>
        </div>
        <div className="max-h-56 overflow-auto divide-y divide-slate-800/60">
          {feed.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-slate-500">No activity yet</div>
          ) : feed.map((item) => {
            const mine = !!user && item.account.toLowerCase() === user.toLowerCase();
            const typeColor = item.type === 'filled' ? 'text-cyan-400' : item.type === 'cancelled' ? 'text-amber-400' : 'text-slate-300';
            return (
              <div key={item.id} className="px-4 py-2.5 flex items-center gap-4 text-xs font-mono">
                <span className={`uppercase font-semibold w-20 ${typeColor}`}>{item.type}</span>
                <span className="text-slate-400">{item.sideLabel}</span>
                <span className="text-slate-500">@{item.tickLabel}</span>
                <span className="text-slate-300 flex-1 text-right">{fmt(item.amount, 18, 2)} shares</span>
                <span className={mine ? 'text-emerald-400' : 'text-slate-600'}>{mine ? 'You' : shortAddr(item.account)}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Last tx */}
      {lastTx && (
        <div className="text-center">
          <a href={explorerUrl('tx', lastTx)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white font-mono">
            Last tx: {lastTx.slice(0, 10)}…{lastTx.slice(-6)} <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
};

export default Pro;
