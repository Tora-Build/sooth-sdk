/**
 * Pro Trading Page — SoothBook Orderbook Terminal
 *
 * Pro-grade heatmap orderbook with trading panel.
 * Markets loaded from deployments.json.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownUp, ChevronDown, ChevronUp, ExternalLink,
  Loader2, Minus, Plus, RefreshCw, Wallet,
} from 'lucide-react';
import {
  useAccount, usePublicClient, useReadContract,
  useSwitchChain, useWriteContract,
} from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import toast from 'react-hot-toast';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ERC20_ABI, SOOTHBOOK_ABI } from '../config/abis';
import { useSoothBookMarket } from '../hooks/useSoothBook';
import { useSoothBookFeed } from '../hooks/useSoothBookFeed';
import deployments from '../config/deployments.json';

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const TICK_WINDOW = 20;
const REFRESH_INTERVAL = 12_000;

type Network = {
  chainId?: number;
  contracts?: Record<string, string>;
  markets?: string[];
};

const deploymentNetworks = Object.values(deployments.networks as Record<string, Network>);
const firstNetwork = deploymentNetworks[0];
const TARGET_CHAIN_ID = firstNetwork?.chainId ?? 84532;

const network = deploymentNetworks.find((n) => n.chainId === TARGET_CHAIN_ID) ?? firstNetwork;

const SOOTHBOOK = network?.contracts?.SoothBook as `0x${string}` | undefined;
const USDC = network?.contracts?.MockUSDC as `0x${string}` | undefined;
const MARKET_KEYS = (network?.markets ?? []) as `0x${string}`[];

const fmt = (v: bigint | undefined, dec = 18, dp = 2) =>
  v === undefined ? '—' : Number(formatUnits(v, dec)).toFixed(dp);
const shortKey = (k: string) => `${k.slice(0, 8)}…${k.slice(-6)}`;
const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const explorerUrl = (s: 'tx' | 'address', v: string) =>
  `https://sepolia.basescan.org/${s}/${v}`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BookRow = { tick: number; amount: bigint; count: bigint };
type UserOrder = {
  side: 'YES' | 'NO';
  tick: string;
  amount: bigint;
  status: 'open' | 'filled' | 'cancelled';
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function HeatmapRow({
  row,
  side,
  maxAmount,
  onClickTick,
}: {
  row: BookRow;
  side: 'yes' | 'no';
  maxAmount: bigint;
  onClickTick: (tick: number) => void;
}) {
  const pct = maxAmount > 0n ? Number((row.amount * 10000n) / maxAmount) / 100 : 0;
  const isYes = side === 'yes';
  return (
    <div
      className="orderbook-row relative cursor-pointer"
      onClick={() => onClickTick(row.tick)}
    >
      <div
        className={`orderbook-depth ${isYes ? 'bid' : 'ask'}`}
        style={{
          width: `${Math.min(pct, 100)}%`,
          opacity: 0.15 + Math.min(pct / 100, 1) * 0.4,
          ...(isYes ? { left: 0, right: 'auto' } : {}),
        }}
      />
      <div className="relative z-10 flex items-center w-full tabular-nums">
        <span className="w-14 text-slate-300">{row.tick}</span>
        <span className="w-16 text-slate-500">{(row.tick / 10).toFixed(1)}%</span>
        <span className={`flex-1 text-right ${isYes ? 'text-emerald-400' : 'text-rose-400'}`}>
          {row.amount > 0n ? fmt(row.amount, 18, 2) : ''}
        </span>
        <span className="w-12 text-right text-slate-600">
          {row.count > 0n ? row.count.toString() : ''}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const Pro = () => {
  const { address: user, isConnected, chainId: walletChain } = useAccount();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  // Market selection
  const [marketIdx, setMarketIdx] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const marketKey = MARKET_KEYS[marketIdx];
  const canRead = !!SOOTHBOOK && !!marketKey;
  const isWrongNetwork = walletChain !== TARGET_CHAIN_ID;

  // Trade form
  const [side, setSide] = useState<'yes' | 'no'>('yes');
  const [tickInput, setTickInput] = useState('500');
  const [sharesInput, setSharesInput] = useState('');
  const [maxCostInput, setMaxCostInput] = useState('');
  const [escrow, setEscrow] = useState(false);
  const [mintAmt, setMintAmt] = useState('');
  const [mergeAmt, setMergeAmt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastTx, setLastTx] = useState<string | null>(null);

  // Orderbook
  const [yesRows, setYesRows] = useState<BookRow[]>([]);
  const [noRows, setNoRows] = useState<BookRow[]>([]);
  const [isBookLoading, setIsBookLoading] = useState(false);

  // Activity
  const { feed, isLoading: isFeedLoading, refresh: refreshFeed } = useSoothBookFeed(SOOTHBOOK, marketKey);
  const [feedOpen, setFeedOpen] = useState(false);

  // Derived
  const tick = Math.max(1, Math.min(999, Number(tickInput) || 500));
  const prob = (tick / 10).toFixed(1);

  // On-chain reads
  const { marketState, prices, backing, isLoading: isMarketLoading } =
    useSoothBookMarket(SOOTHBOOK, marketKey);

  const { data: usdcBal = 0n } = useReadContract({
    address: USDC, abi: ERC20_ABI, functionName: 'balanceOf',
    args: user ? [user] : undefined,
    query: { enabled: !!user && !!USDC },
  });
  const { data: allowance = 0n } = useReadContract({
    address: USDC, abi: ERC20_ABI, functionName: 'allowance',
    args: user && SOOTHBOOK ? [user, SOOTHBOOK] : undefined,
    query: { enabled: !!user && !!USDC && !!SOOTHBOOK },
  });
  const { data: balTuple } = useReadContract({
    address: SOOTHBOOK, abi: SOOTHBOOK_ABI, functionName: 'getBalance',
    args: marketKey && user ? [marketKey, user] : undefined,
    query: { enabled: !!user && canRead },
  });
  const yesBal = (balTuple as readonly [bigint, bigint] | undefined)?.[0] ?? 0n;
  const noBalVal = (balTuple as readonly [bigint, bigint] | undefined)?.[1] ?? 0n;

  // Prices
  const bestYes = prices.bestYesTick ?? 0;
  const bestNo = prices.bestNoTick ?? 0;
  const yesProb = prices.yesPrice
    ? (Number(formatUnits(prices.yesPrice, 18)) * 100).toFixed(1)
    : '—';
  const noProb = prices.noPrice
    ? (Number(formatUnits(prices.noPrice, 18)) * 100).toFixed(1)
    : '—';
  const spread = bestYes > 0 && bestNo > 0
    ? (1000 - bestYes - bestNo)
    : null;

  // Cost estimate
  const costEstimate = useMemo(() => {
    const shares = Number(sharesInput);
    if (!shares || shares <= 0) return null;
    const cost = shares * (tick / 1000);
    return cost;
  }, [sharesInput, tick]);

  // Network switch
  const ensureNetwork = async () => {
    if (!isWrongNetwork) return true;
    if (!switchChainAsync) { toast.error('Cannot switch network'); return false; }
    try {
      const r = await switchChainAsync({ chainId: TARGET_CHAIN_ID });
      return r.id === TARGET_CHAIN_ID;
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Switch to Base Sepolia');
      return false;
    }
  };

  // Write helper
  const exec = async (
    label: string, fn: string, args: readonly unknown[],
    addr?: `0x${string}`, abi?: typeof SOOTHBOOK_ABI | typeof ERC20_ABI,
  ) => {
    if (!isConnected || !user) { toast.error('Connect wallet'); return; }
    if (!(await ensureNetwork())) return;
    const target = addr ?? SOOTHBOOK;
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
      toast.error(err.shortMessage ?? err.message ?? 'Failed', { id: tid });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Orderbook fetch
  const refreshBook = useCallback(async () => {
    if (!publicClient || !SOOTHBOOK || !marketKey) return;
    setIsBookLoading(true);
    try {
      const center = bestYes > 0 && bestNo > 0
        ? Math.round((bestYes + (1000 - bestNo)) / 2)
        : 500;
      const lo = Math.max(1, center - TICK_WINDOW);
      const hi = Math.min(999, center + TICK_WINDOW);
      const calls: Array<{
        address: `0x${string}`; abi: typeof SOOTHBOOK_ABI;
        functionName: 'getOrdersAtTick'; args: readonly [`0x${string}`, number, number];
      }> = [];
      for (let t = lo; t <= hi; t++) {
        calls.push({ address: SOOTHBOOK, abi: SOOTHBOOK_ABI, functionName: 'getOrdersAtTick', args: [marketKey, 1, t] });
        calls.push({ address: SOOTHBOOK, abi: SOOTHBOOK_ABI, functionName: 'getOrdersAtTick', args: [marketKey, 0, t] });
      }
      const res = await publicClient.multicall({ contracts: calls });
      const yes: BookRow[] = [];
      const no: BookRow[] = [];
      let i = 0;
      for (let t = lo; t <= hi; t++) {
        const y = res[i++];
        const n = res[i++];
        const yt = y.status === 'success' ? (y.result as readonly [bigint, bigint]) : [0n, 0n] as const;
        const nt = n.status === 'success' ? (n.result as readonly [bigint, bigint]) : [0n, 0n] as const;
        if (yt[0] > 0n) yes.push({ tick: t, amount: yt[0], count: yt[1] });
        if (nt[0] > 0n) no.push({ tick: t, amount: nt[0], count: nt[1] });
      }
      yes.sort((a, b) => b.tick - a.tick);
      no.sort((a, b) => a.tick - b.tick);
      setYesRows(yes);
      setNoRows(no);
    } catch {
      toast.error('Failed to load orderbook');
    } finally {
      setIsBookLoading(false);
    }
  }, [publicClient, marketKey, bestYes, bestNo]);

  // Auto-load + auto-refresh
  useEffect(() => {
    if (!canRead || !publicClient || isWrongNetwork) return;
    void refreshBook();
    void refreshFeed();
    const iv = setInterval(() => { void refreshBook(); }, REFRESH_INTERVAL);
    return () => clearInterval(iv);
  }, [canRead, publicClient, isWrongNetwork, refreshBook, refreshFeed]);

  // Max amounts for heatmap scaling
  const maxYes = useMemo(() => yesRows.reduce((m: bigint, r: BookRow) => r.amount > m ? r.amount : m, 0n), [yesRows]);
  const maxNo = useMemo(() => noRows.reduce((m: bigint, r: BookRow) => r.amount > m ? r.amount : m, 0n), [noRows]);
  const maxAll = maxYes > maxNo ? maxYes : maxNo;

  // Click on orderbook row → fill tick
  const handleTickClick = (t: number) => setTickInput(String(t));

  const myOpenOrders = useMemo(() => {
    if (!user) return [] as UserOrder[];

    const userLc = user.toLowerCase();
    const orders = new Map<string, UserOrder>();

    const reduceOrder = (
      orderSide: 'YES' | 'NO',
      orderTick: string,
      amount: bigint,
      status: 'filled' | 'cancelled',
    ) => {
      const key = `${orderSide}-${orderTick}`;
      const existing = orders.get(key);
      if (!existing) return;
      if (existing.amount <= amount) {
        existing.amount = 0n;
        existing.status = status;
      } else {
        existing.amount -= amount;
        existing.status = 'open';
      }
      orders.set(key, existing);
    };

    for (const item of feed) {
      if (item.type !== 'placed') continue;
      if (item.who.toLowerCase() !== userLc) continue;
      const sideLabel = item.side === 'YES' ? 'YES' : 'NO';
      const key = `${sideLabel}-${item.tick}`;
      const existing = orders.get(key);
      if (existing) {
        existing.amount += item.amount;
        existing.status = 'open';
        orders.set(key, existing);
      } else {
        orders.set(key, { side: sideLabel, tick: item.tick, amount: item.amount, status: 'open' });
      }
    }

    for (const item of feed) {
      if (item.type === 'cancelled' && item.who.toLowerCase() === userLc) {
        const sideLabel = item.side === 'YES' ? 'YES' : 'NO';
        reduceOrder(sideLabel, item.tick, item.amount, 'cancelled');
      }

      if (item.type === 'filled' && item.maker?.toLowerCase() === userLc && item.makerSide && item.makerTick) {
        reduceOrder(item.makerSide, item.makerTick, item.amount, 'filled');
      }
    }

    return Array.from(orders.values())
      .filter((order) => order.amount > 0n)
      .sort((a, b) => Number(a.tick) - Number(b.tick));
  }, [feed, user]);

  // ---------------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------------

  if (!SOOTHBOOK || MARKET_KEYS.length === 0) {
    return (
      <div className="flex items-center justify-center py-32 text-slate-500 text-sm">
        No SoothBook deployment configured.
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
      {/* ═══ Header Bar ═══ */}
      <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-sm">
        {/* Left: market selector */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-700/50 bg-slate-900/60 hover:border-slate-600 transition-colors text-white text-sm font-mono min-w-[200px]"
          >
            <span className="truncate flex-1 text-left">{shortKey(marketKey)}</span>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          {dropdownOpen && (
            <div className="absolute z-50 mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
              {MARKET_KEYS.map((k, i) => (
                <button
                  key={k}
                  onClick={() => { setMarketIdx(i); setDropdownOpen(false); }}
                  className={`w-full text-left px-3 py-2.5 text-xs font-mono hover:bg-slate-800 transition-colors ${
                    i === marketIdx ? 'bg-amber-500/10 text-amber-300' : 'text-slate-300'
                  }`}
                >
                  {shortKey(k)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Center: prices */}
        <div className="flex items-center gap-4 text-sm font-mono">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase text-slate-500">YES</span>
            <span className="text-emerald-400 font-bold">{yesProb}%</span>
            {bestYes > 0 && <span className="text-[10px] text-slate-600">@{bestYes}</span>}
          </div>
          {spread !== null && (
            <span className="text-[10px] text-slate-600 border border-slate-800 rounded px-1.5 py-0.5">
              {spread > 0 ? `${(spread / 10).toFixed(1)}% spread` : 'crossed'}
            </span>
          )}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase text-slate-500">NO</span>
            <span className="text-rose-400 font-bold">{noProb}%</span>
            {bestNo > 0 && <span className="text-[10px] text-slate-600">@{bestNo}</span>}
          </div>
        </div>

        {/* Right: status + backing */}
        <div className="flex items-center gap-3">
          <div className="text-xs font-mono text-slate-400">
            {fmt(backing as bigint | undefined, 6, 0)} <span className="text-slate-600">USDC</span>
          </div>
          {isWrongNetwork && isConnected && (
            <Button size="xs" variant="danger" onClick={() => switchChainAsync?.({ chainId: TARGET_CHAIN_ID })} disabled={isSwitching}>
              {isSwitching ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Switch'}
            </Button>
          )}
          <Badge variant={marketState.isActive ? 'live' : marketState.isFinalized ? 'warning' : 'default'}>
            {marketState.isFinalized ? 'Resolved' : marketState.isActive ? 'Live' : 'Loading'}
          </Badge>
          <a href={explorerUrl('address', SOOTHBOOK)} target="_blank" rel="noreferrer" className="text-slate-600 hover:text-slate-400">
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* ═══ Main Panel ═══ */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* ─── Orderbook ─── */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-slate-800/40">
          {/* Orderbook header */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-slate-800/40">
            <div className="flex items-center gap-3">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Orderbook</h3>
              {isBookLoading && <Loader2 className="w-3 h-3 animate-spin text-slate-600" />}
            </div>
            <div className="flex items-center gap-3 text-[10px] font-mono text-slate-600">
              <span>Tick</span>
              <span>Prob</span>
              <span>Depth</span>
              <span>#</span>
              <button onClick={() => void refreshBook()} className="ml-2 text-slate-500 hover:text-slate-300">
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Orderbook body */}
          <div className="flex-1 overflow-auto no-scrollbar">
            {yesRows.length === 0 && noRows.length === 0 && !isBookLoading ? (
              <div className="flex items-center justify-center h-full text-slate-600 text-xs">
                No liquidity — place the first order
              </div>
            ) : (
              <div className="flex flex-col h-full">
                {/* YES side (bids) — top half */}
                <div className="flex-1 flex flex-col justify-end overflow-auto no-scrollbar">
                  {yesRows.map((r) => (
                    <HeatmapRow key={`y-${r.tick}`} row={r} side="yes" maxAmount={maxAll} onClickTick={handleTickClick} />
                  ))}
                </div>

                {/* Spread indicator */}
                <div className="flex-shrink-0 flex items-center justify-center gap-4 px-4 py-1.5 bg-slate-900/50 border-y border-slate-800/30">
                  <span className="text-[10px] text-emerald-400/60 font-mono">
                    {bestYes > 0 ? `${(bestYes / 10).toFixed(1)}%` : '—'}
                  </span>
                  <span className="text-[10px] text-slate-600">
                    {spread !== null
                      ? spread <= 0
                        ? 'CROSSED'
                        : `${(spread / 10).toFixed(1)}% spread`
                      : '— spread'}
                  </span>
                  <span className="text-[10px] text-rose-400/60 font-mono">
                    {bestNo > 0 ? `${((1000 - bestNo) / 10).toFixed(1)}%` : '—'}
                  </span>
                </div>

                {/* NO side (asks) — bottom half */}
                <div className="flex-1 overflow-auto no-scrollbar">
                  {noRows.map((r) => (
                    <HeatmapRow key={`n-${r.tick}`} row={r} side="no" maxAmount={maxAll} onClickTick={handleTickClick} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ─── Trade Sidebar ─── */}
        <div className="flex-shrink-0 w-full lg:w-80 overflow-auto no-scrollbar bg-slate-950/50">
          <div className="p-4 space-y-4">
            {/* Side toggle */}
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => setSide('yes')}
                className={side === 'yes' ? 'btn-buy rounded-lg py-2.5 text-sm' : 'rounded-lg py-2.5 text-sm border border-slate-700 bg-slate-950 text-slate-400 hover:border-emerald-500/30 hover:text-emerald-300 transition-colors'}
              >
                Buy YES
              </button>
              <button
                onClick={() => setSide('no')}
                className={side === 'no' ? 'btn-sell rounded-lg py-2.5 text-sm' : 'rounded-lg py-2.5 text-sm border border-slate-700 bg-slate-950 text-slate-400 hover:border-rose-500/30 hover:text-rose-300 transition-colors'}
              >
                Buy NO
              </button>
            </div>

            {/* Tick input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] uppercase tracking-wider text-slate-500">Tick</label>
                <span className="text-[10px] font-mono text-slate-500">{prob}% probability</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-white transition-colors"
                  onClick={() => setTickInput(String(Math.max(1, tick - 1)))}
                >
                  <Minus className="w-3 h-3" />
                </button>
                <input
                  value={tickInput}
                  onChange={(e) => setTickInput(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-white text-center focus:border-amber-500/50 focus:outline-none"
                  placeholder="500"
                />
                <button
                  className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-white transition-colors"
                  onClick={() => setTickInput(String(Math.min(999, tick + 1)))}
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Shares input */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1">Shares (WAD)</label>
              <input
                value={sharesInput}
                onChange={(e) => setSharesInput(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-white focus:border-amber-500/50 focus:outline-none"
                placeholder="e.g. 100"
              />
            </div>

            {/* Max cost */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1">Max Cost (USDC, 0 = no limit)</label>
              <input
                value={maxCostInput}
                onChange={(e) => setMaxCostInput(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-white focus:border-amber-500/50 focus:outline-none"
                placeholder="0"
              />
            </div>

            {/* Escrow toggle */}
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
              <input type="checkbox" checked={escrow} onChange={(e) => setEscrow(e.target.checked)} className="accent-amber-500 rounded" />
              Escrow exit (lock opposite tokens)
            </label>

            {/* Cost estimate */}
            {costEstimate !== null && costEstimate > 0 && (
              <div className="flex items-center justify-between text-xs bg-slate-900/50 rounded-lg px-3 py-2 border border-slate-800/50">
                <span className="text-slate-500">Est. cost</span>
                <span className="font-mono text-white">{costEstimate.toFixed(2)} <span className="text-slate-500">USDC</span></span>
              </div>
            )}

            {/* Submit */}
            <button
              className={`w-full rounded-lg py-3 text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                side === 'yes' ? 'btn-buy' : 'btn-sell'
              }`}
              disabled={!sharesInput || Number(sharesInput) <= 0 || !canRead || isSubmitting}
              onClick={() => {
                if (!marketKey) return;
                const shares = parseUnits(sharesInput, 18);
                if (escrow && side === 'yes' && noBalVal < shares) {
                  toast.error('Insufficient NO tokens for escrow sell');
                  return;
                }
                if (escrow && side === 'no' && yesBal < shares) {
                  toast.error('Insufficient YES tokens for escrow sell');
                  return;
                }
                const maxCost = maxCostInput && Number(maxCostInput) > 0
                  ? parseUnits(maxCostInput, 6)
                  : 0n;
                const fn = side === 'yes' ? 'buyYes' : 'buyNo';
                void exec(
                  `Placing ${side.toUpperCase()} @ ${prob}%…`,
                  fn,
                  [marketKey, tick, shares, escrow, maxCost],
                );
              }}
            >
              {isSubmitting
                ? <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                : `Buy ${side.toUpperCase()} @ ${prob}%`}
            </button>

            {/* Divider */}
            <div className="border-t border-slate-800/50" />

            {/* Positions */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Wallet className="w-3 h-3 text-slate-500" />
                <span className="text-[10px] uppercase tracking-wider text-slate-500">Positions</span>
              </div>
              {!isConnected ? (
                <div className="text-xs text-slate-600">Connect wallet</div>
              ) : (
                <div className="space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">USDC</span>
                    <span className="text-white">{fmt(usdcBal as bigint, 6, 2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-emerald-400/70">YES</span>
                    <span className="text-emerald-400">{fmt(yesBal, 18, 4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-rose-400/70">NO</span>
                    <span className="text-rose-400">{fmt(noBalVal, 18, 4)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 pt-1 border-t border-slate-800/30">
                    <span>Allowance</span>
                    <span>{fmt(allowance as bigint, 6, 2)}</span>
                  </div>
                  {(allowance as bigint) < parseUnits('100', 6) && (
                    <Button
                      size="xs" variant="ghost" className="w-full mt-1"
                      disabled={!USDC || !SOOTHBOOK || isSubmitting}
                      onClick={() => USDC && SOOTHBOOK && exec('Approving…', 'approve', [SOOTHBOOK, parseUnits('100000', 6)], USDC, ERC20_ABI)}
                    >
                      Approve USDC
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-slate-800/50" />

            {/* Mint / Merge */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <ArrowDownUp className="w-3 h-3 text-slate-500" />
                <span className="text-[10px] uppercase tracking-wider text-slate-500">Mint / Merge</span>
              </div>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    value={mintAmt}
                    onChange={(e) => setMintAmt(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 font-mono text-xs text-white focus:border-amber-500/50 focus:outline-none"
                    placeholder="Amount (USDC)"
                  />
                  <Button
                    size="xs" variant="info"
                    disabled={!mintAmt || Number(mintAmt) <= 0 || !marketKey || isSubmitting}
                    onClick={() => marketKey && exec('Minting…', 'mint', [marketKey, parseUnits(mintAmt, 6)])}
                  >
                    Mint
                  </Button>
                </div>
                <div className="flex gap-2">
                  <input
                    value={mergeAmt}
                    onChange={(e) => setMergeAmt(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 font-mono text-xs text-white focus:border-amber-500/50 focus:outline-none"
                    placeholder="Amount (USDC)"
                  />
                  <Button
                    size="xs" variant="secondary"
                    disabled={!mergeAmt || Number(mergeAmt) <= 0 || !marketKey || isSubmitting}
                    onClick={() => marketKey && exec('Merging…', 'merge', [marketKey, parseUnits(mergeAmt, 6)])}
                  >
                    Merge
                  </Button>
                </div>
                {marketState.isFinalized && (
                  <Button
                    size="xs" variant="success" className="w-full"
                    disabled={!marketKey || isSubmitting}
                    onClick={() => marketKey && exec('Redeeming…', 'redeem', [marketKey])}
                  >
                    Redeem Winnings
                  </Button>
                )}
              </div>
            </div>

            {isConnected && (
              <>
                {/* Divider */}
                <div className="border-t border-slate-800/50" />

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500">My Orders</span>
                    <span className="text-[10px] bg-slate-800 text-slate-400 rounded-full px-1.5 py-0.5">{myOpenOrders.length}</span>
                  </div>
                  {myOpenOrders.length === 0 ? (
                    <div className="text-xs text-slate-600">No open orders</div>
                  ) : (
                    <div className="space-y-1.5">
                      {myOpenOrders.map((order) => {
                        const sideNum = order.side === 'YES' ? 1 : 0;
                        const sideClass = order.side === 'YES' ? 'text-emerald-400' : 'text-rose-400';
                        return (
                          <div key={`${order.side}-${order.tick}`} className="flex items-center gap-2 text-xs font-mono rounded-lg border border-slate-800/50 px-2 py-1.5">
                            <span className={`w-8 font-semibold ${sideClass}`}>{order.side}</span>
                            <span className="text-slate-500">@{order.tick}</span>
                            <span className="text-slate-200 flex-1 text-right">{fmt(order.amount, 18, 2)}</span>
                            <Button
                              size="xs"
                              variant="ghost"
                              className="h-6 px-2"
                              disabled={!marketKey || isSubmitting}
                              onClick={() => marketKey && void exec('Cancelling…', 'cancel', [marketKey, sideNum, Number(order.tick)])}
                            >
                              Cancel
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Activity Feed (collapsible) ═══ */}
      <div className="flex-shrink-0 border-t border-slate-800/40">
        <button
          onClick={() => setFeedOpen(!feedOpen)}
          className="w-full flex items-center justify-between px-4 py-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="uppercase tracking-wider font-semibold">Activity</span>
            {feed.length > 0 && (
              <span className="text-[10px] bg-slate-800 text-slate-400 rounded-full px-1.5 py-0.5">{feed.length}</span>
            )}
            {isFeedLoading && <Loader2 className="w-3 h-3 animate-spin" />}
          </div>
          {feedOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
        {feedOpen && (
          <div className="max-h-48 overflow-auto no-scrollbar border-t border-slate-800/30">
            {feed.length === 0 ? (
              <div className="px-4 py-4 text-center text-xs text-slate-600">No activity</div>
            ) : feed.map((item) => {
              const mine = !!user && item.who.toLowerCase() === user.toLowerCase();
              const tc = item.type === 'filled' ? 'text-amber-400' : item.type === 'cancelled' ? 'text-slate-500' : 'text-slate-300';
              return (
                <div key={item.id} className="px-4 py-1.5 flex items-center gap-3 text-[11px] font-mono hover:bg-slate-900/30">
                  <span className={`uppercase font-semibold w-16 ${tc}`}>{item.type}</span>
                  <span className={item.side.includes('YES') ? 'text-emerald-400' : 'text-rose-400'}>{item.side}</span>
                  <span className="text-slate-600">@{item.tick}</span>
                  <span className="text-slate-300 flex-1 text-right">{fmt(item.amount, 18, 2)}</span>
                  <span className={mine ? 'text-amber-300' : 'text-slate-700'}>{mine ? 'You' : shortAddr(item.who)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Last tx link */}
      {lastTx && (
        <div className="flex-shrink-0 text-center py-1.5 border-t border-slate-800/20">
          <a href={explorerUrl('tx', lastTx)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] text-slate-600 hover:text-slate-400 font-mono">
            tx: {lastTx.slice(0, 10)}…{lastTx.slice(-6)} <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      )}
    </div>
  );
};

export default Pro;
