/**
 * TickBook Page - Professional Trading Interface
 * 
 * High-performance terminal for market makers and arbitrageurs.
 * Highlights the 10,000-tick bitmap architecture.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Plus, Minus, HelpCircle, X, ArrowLeftRight, 
  TrendingUp, TrendingDown, Zap, Clock, RefreshCw,
  LayoutGrid, List, BarChart3, Wallet, Info, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { useAccount, useChainId, useWriteContract, usePublicClient } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { 
  useAmmMarketDirect, 
  useTruthMarketDirect, 
  useLaunchpadMarketDirect, 
  useCollateralizerDirect,
  useTickBookDirect,
  useTokenBalances
} from '../hooks/v8';
import { useDeployments } from '../hooks/useDeployments';
import { V8_ABIS } from '../config/abis';
import { 
  TickMap, 
  TickLadder, 
  OrderbookDepth 
} from '../components/features/v8/TickBook';
import marketsConfig from '../config/markets.json';
import uiContent from '../config/ui-content.json';
import { cn } from '../lib/utils';

const { pro: content } = uiContent;

export const Pro = () => {
  const { marketId } = useParams<{ marketId?: string }>();
  const navigate = useNavigate();
  const { isConnected, address: userAddress } = useAccount();
  const chainId = useChainId();
  const { contracts } = useDeployments();
  const { writeContractAsync } = useWriteContract();

  // Filter V8 markets for current chain
  const v8Markets = useMemo(() => {
    return marketsConfig.markets.filter(m => 
      m.version === 'v8.1' && m.chainId === chainId
    );
  }, [chainId]);

  // Find selected market
  const selectedMarket = useMemo(() => {
    if (marketId) {
      return v8Markets.find(m => m.contractAddress.toLowerCase() === marketId.toLowerCase());
    }
    return v8Markets[0];
  }, [marketId, v8Markets]);

  // Data Fetching
  const marketAddr = selectedMarket?.contractAddress as `0x${string}`;
  const { amm } = useAmmMarketDirect(marketAddr);
  const { launchpad } = useLaunchpadMarketDirect(marketAddr);
  const { market: truth } = useTruthMarketDirect(marketAddr);
  const { collateralizer, isLoading: isTokensLoading } = useCollateralizerDirect(marketAddr);
  
  const { tickBook, isLoading: isTickBookLoading, refetch: refetchTickBook } = useTickBookDirect(
    marketAddr,
    collateralizer?.yesToken,
    collateralizer?.noToken
  );

  const { balances, refetch: refetchBalances } = useTokenBalances([
    contracts.MockUSDC as `0x${string}`,
    collateralizer?.yesToken as `0x${string}`,
    collateralizer?.noToken as `0x${string}`
  ]);

  const [usdcBalance, yesBalance, noBalance] = balances;

  // UI State
  const [tradeMode, setTradeMode] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'limit' | 'market'>('limit');
  const [priceInput, setPriceInput] = useState('');
  const [priceUpperInput, setPriceUpperInput] = useState(''); // For ranged limit orders
  const [sizeInput, setSizeInput] = useState('');
  const [optimisticOrders, setOptimisticOrders] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'inventory' | 'history'>('inventory');

  // Derived State
  const isGraduated = launchpad?.isGraduated ?? false;
  const currentTick = tickBook?.currentTick ?? 5000;
  const bids = tickBook?.bids ?? [];
  const asks = tickBook?.asks ?? [];

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT') return;

    switch (e.key) {
      case 'b': case 'B': setTradeMode('buy'); break;
      case 's': case 'S': setTradeMode('sell'); break;
      case 'Escape': 
        setPriceInput(''); 
        setSizeInput(''); 
        break;
      case 'ArrowUp':
        setPriceInput(p => (Math.min(0.9999, parseFloat(p || '0.5') + (e.shiftKey ? 0.01 : 0.001))).toFixed(4));
        break;
      case 'ArrowDown':
        setPriceInput(p => (Math.max(0.0001, parseFloat(p || '0.5') - (e.shiftKey ? 0.01 : 0.001))).toFixed(4));
        break;
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleTickClick = (tick: number, side?: 'buy' | 'sell') => {
    setPriceInput((tick / 10000).toFixed(4));
    if (side) setTradeMode(side);
  };

  const handleExecuteTrade = async () => {
    if (!sizeInput || !tickBook?.marketKey) return;
    
    const amountIn = parseUnits(sizeInput, 18);
    
    if (orderType === 'market') {
      const slippageTick = tradeMode === 'buy' ? 9999 : 0; // Default max slippage for now
      try {
        await writeContractAsync({
          address: contracts.TickBook as `0x${string}`,
          abi: V8_ABIS.TickBook,
          functionName: 'executeMarketOrder',
          args: [
            tickBook.marketKey,
            tradeMode === 'buy',
            amountIn,
            slippageTick
          ]
        });
        refetchTickBook();
        refetchBalances();
      } catch (err) {
        console.error('Market order failed', err);
      }
      return;
    }

    // Limit Order (Ranged)
    if (!priceInput) return;
    const tickLower = Math.round(parseFloat(priceInput) * 10000);
    const tickUpper = priceUpperInput ? Math.round(parseFloat(priceUpperInput) * 10000) : tickLower;
    
    // Optimistic UI
    const newOrder = {
      id: Date.now(),
      price: parseFloat(priceInput),
      priceUpper: priceUpperInput ? parseFloat(priceUpperInput) : undefined,
      size: parseFloat(sizeInput),
      side: tradeMode,
      status: 'pending'
    };
    setOptimisticOrders(prev => [newOrder, ...prev]);

    try {
      await writeContractAsync({
        address: contracts.TickBook as `0x${string}`,
        abi: V8_ABIS.TickBook,
        functionName: 'placeLimitOrder',
        args: [
          tickBook.marketKey,
          Math.min(tickLower, tickUpper),
          Math.max(tickLower, tickUpper),
          amountIn
        ]
      });
      refetchTickBook();
      refetchBalances();
    } catch (err) {
      console.error('Limit order failed', err);
    } finally {
      setOptimisticOrders(prev => prev.filter(o => o.id !== newOrder.id));
    }
  };

  const handleSplit = async () => {
    if (!sizeInput) return;
    try {
      await writeContractAsync({
        address: contracts.Collateralizer as `0x${string}`,
        abi: V8_ABIS.Collateralizer,
        functionName: 'split',
        args: [marketAddr, parseUnits(sizeInput, 18)]
      });
      refetchBalances();
    } catch (err) {
      console.error('Split failed', err);
    }
  };

  const handleMerge = async () => {
    if (!sizeInput) return;
    try {
      await writeContractAsync({
        address: contracts.Collateralizer as `0x${string}`,
        abi: V8_ABIS.Collateralizer,
        functionName: 'merge',
        args: [marketAddr, parseUnits(sizeInput, 18)]
      });
      refetchBalances();
    } catch (err) {
      console.error('Merge failed', err);
    }
  };

  if (!isGraduated && !isTickBookLoading && !isTokensLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md text-center p-8 border-amber-500/20 bg-amber-500/5">
          <div className="relative inline-block mb-4">
            <Zap className="w-12 h-12 text-amber-500" />
            <div className="absolute inset-0 blur-xl bg-amber-500/20 -z-10" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">{content.restricted.title}</h2>
          <p className="text-slate-400 mb-6">
            {content.restricted.description}
          </p>
          <Button
            variant="primary"
            onClick={() => navigate(`/trade/${marketAddr}`)}
            className="w-full"
          >
            {content.restricted.switchButton}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-300 overflow-hidden flex flex-col font-mono selection:bg-cyan-500/30">
      {/* Top Utility Bar */}
      <div className="h-10 border-b border-slate-800 bg-slate-900/40 flex items-center px-4 justify-between shrink-0">
        <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
          {v8Markets.map((m) => (
            <button
              key={m.id}
              onClick={() => navigate(`/pro/${m.contractAddress}`)}
              className={cn(
                "flex items-center gap-2 px-2 py-1 rounded text-[10px] font-bold transition-all",
                selectedMarket?.id === m.id 
                  ? "bg-cyan-500 text-black shadow-[0_0_10px_rgba(6,182,212,0.4)]" 
                  : "text-slate-500 hover:text-slate-300"
              )}
            >
              {m.symbol}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          <span className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_#10b981]" />
            {content.utility.network}: {chainId === 84532 ? 'Base Sepolia' : 'Chain ' + chainId}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {content.utility.latency}: 12ms
          </span>
        </div>
      </div>

      {/* Main 4-Pane Grid */}
      <div className="flex-1 grid grid-cols-12 grid-rows-6 gap-px bg-slate-800 overflow-hidden">
        
        {/* Pane 1: Left Sidebar (Inventory) */}
        <div className="col-span-2 row-span-6 bg-slate-950 p-3 flex flex-col gap-4 border-r border-slate-800">
          <div className="flex p-0.5 bg-slate-900 rounded-md mb-2">
            <button 
              onClick={() => setActiveTab('inventory')}
              className={cn("flex-1 py-1 text-[9px] font-bold rounded", activeTab === 'inventory' ? "bg-slate-800 text-white" : "text-slate-500")}
            >
              {content.tabs.inventory}
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={cn("flex-1 py-1 text-[9px] font-bold rounded", activeTab === 'history' ? "bg-slate-800 text-white" : "text-slate-500")}
            >
              {content.tabs.history}
            </button>
          </div>

          {activeTab === 'inventory' ? (
            <div className="space-y-4 animate-fade-in flex-1">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2">
                <Wallet className="w-3 h-3" />
                {content.inventory.balances}
              </h3>
              
              <div className="space-y-2">
                <div className="p-2 rounded bg-slate-900/50 border border-slate-800">
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-slate-500">USDC</span>
                    <span className="text-white tabular-nums">{formatUnits(usdcBalance, 6).split('.')[0]}</span>
                  </div>
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-emerald-400">YES</span>
                    <span className="text-white tabular-nums">{formatUnits(yesBalance, 18).split('.')[0]}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-rose-400">NO</span>
                    <span className="text-white tabular-nums">{formatUnits(noBalance, 18).split('.')[0]}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={handleSplit}
                    className="py-1.5 text-[9px] font-bold bg-slate-800 hover:bg-slate-700 rounded text-slate-300 flex items-center justify-center gap-1"
                  >
                    <ArrowUpRight className="w-3 h-3" />
                    {content.inventory.split}
                  </button>
                  <button 
                    onClick={handleMerge}
                    className="py-1.5 text-[9px] font-bold bg-slate-800 hover:bg-slate-700 rounded text-slate-300 flex items-center justify-center gap-1"
                  >
                    <ArrowDownRight className="w-3 h-3" />
                    {content.inventory.merge}
                  </button>
                </div>
              </div>

              <div className="divider-gradient my-2" />

              <h3 className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2">
                <Info className="w-3 h-3" />
                {content.inventory.details}
              </h3>
              <div className="p-2 rounded bg-slate-900/30 text-[9px] space-y-2">
                <p className="text-slate-400 leading-relaxed italic">
                  {selectedMarket?.description}
                </p>
                <div className="flex justify-between">
                  <span className="text-slate-600 font-bold uppercase">{content.inventory.truthFinality}</span>
                  <span className="text-cyan-400 font-bold">{content.inventory.retroactive}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-700 opacity-50 italic animate-fade-in">
              <BarChart3 className="w-8 h-8 mb-2" />
              <span className="text-[10px]">{content.history.empty}</span>
            </div>
          )}
        </div>

        {/* Pane 2: Center (The Magic visualization) */}
        <div className="col-span-6 row-span-6 bg-[#020617] flex flex-col p-4 gap-4 overflow-hidden border-r border-slate-800">
          <div className="flex-1 flex gap-4 min-h-0">
            {/* Tick Map */}
            <div className="flex-1 flex flex-col min-w-0">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2">
                  <LayoutGrid className="w-3 h-3" />
                  {content.visuals.tickMap}
                </h3>
                <span className="text-[9px] text-slate-600 font-mono">{content.visuals.tickMapSub}</span>
              </div>
              <div className="flex-1 flex items-center justify-center bg-slate-950/50 rounded-lg border border-slate-900 p-2 overflow-hidden shadow-inner">
                <TickMap 
                  currentTick={currentTick}
                  bids={bids}
                  asks={asks}
                  onTickClick={handleTickClick}
                />
              </div>
            </div>

            {/* Tick Ladder */}
            <div className="w-64 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2">
                  <List className="w-3 h-3" />
                  {content.visuals.tickLadder}
                </h3>
              </div>
              <TickLadder 
                currentTick={currentTick}
                bids={bids}
                asks={asks}
                onTickClick={handleTickClick}
              />
            </div>
          </div>

          {/* Depth Chart (Bottom Center) */}
          <div className="h-40 shrink-0 border-t border-slate-800 pt-4">
            <OrderbookDepth bids={bids} asks={asks} />
          </div>
        </div>

        {/* Pane 3: Right (Execution & Orders) */}
        <div className="col-span-4 row-span-6 bg-slate-950 flex flex-col overflow-hidden">
          <div className="p-4 flex flex-col gap-6 overflow-y-auto flex-1">
            {/* Trade Forms */}
            <div className="space-y-4">
              <div className="flex p-0.5 bg-slate-900 rounded-lg">
                <button 
                  onClick={() => setTradeMode('buy')}
                  className={cn(
                    "flex-1 py-2 text-[10px] font-bold rounded-md transition-all",
                    tradeMode === 'buy' ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/20" : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  {content.execution.buyYes}
                </button>
                <button 
                  onClick={() => setTradeMode('sell')}
                  className={cn(
                    "flex-1 py-2 text-[10px] font-bold rounded-md transition-all",
                    tradeMode === 'sell' ? "bg-rose-600 text-white shadow-lg shadow-rose-500/20" : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  {content.execution.sellYes}
                </button>
              </div>

              <div className="flex p-0.5 bg-slate-900/50 rounded-md border border-slate-800">
                <button 
                  onClick={() => setOrderType('limit')}
                  className={cn("flex-1 py-1 text-[9px] font-bold rounded", orderType === 'limit' ? "bg-slate-800 text-cyan-400" : "text-slate-500")}
                >
                  {content.execution.limit}
                </button>
                <button 
                  onClick={() => setOrderType('market')}
                  className={cn("flex-1 py-1 text-[9px] font-bold rounded", orderType === 'market' ? "bg-slate-800 text-cyan-400" : "text-slate-500")}
                >
                  {content.execution.market}
                </button>
              </div>

              <div className="space-y-3">
                {orderType === 'limit' && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex justify-between items-end">
                        <label className="text-[9px] font-bold text-slate-500 uppercase">{content.execution.rangeLower}</label>
                        <span className="text-[10px] text-cyan-400 font-bold">TICK #{(parseFloat(priceInput || '0.5') * 10000).toFixed(0)}</span>
                      </div>
                      <div className="relative">
                        <input 
                          type="number"
                          step="0.0001"
                          value={priceInput}
                          onChange={(e) => setPriceInput(e.target.value)}
                          placeholder="0.5000"
                          className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-cyan-500/50 transition-colors"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between items-end">
                        <label className="text-[9px] font-bold text-slate-500 uppercase">{content.execution.rangeUpper}</label>
                        {priceUpperInput && <span className="text-[10px] text-cyan-400 font-bold">TICK #{(parseFloat(priceUpperInput) * 10000).toFixed(0)}</span>}
                      </div>
                      <div className="relative">
                        <input 
                          type="number"
                          step="0.0001"
                          value={priceUpperInput}
                          onChange={(e) => setPriceUpperInput(e.target.value)}
                          placeholder={content.execution.rangeUpperPlaceholder}
                          className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-cyan-500/50 transition-colors"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase">
                    {orderType === 'market' ? content.execution.amountDollar : content.execution.amountShares}
                  </label>
                  <div className="relative">
                    <input 
                      type="number"
                      value={sizeInput}
                      onChange={(e) => setSizeInput(e.target.value)}
                      placeholder={orderType === 'market' ? "100.00 USDC" : "100.00 SHARES"}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-cyan-500/50 transition-colors"
                    />
                  </div>
                </div>

                <div className="p-2 rounded bg-slate-900/50 border border-slate-800/50 flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="text-[8px] text-slate-600 font-bold uppercase">{content.execution.estimatedValue}</span>
                    <span className="text-white text-xs font-mono">
                      {orderType === 'market' 
                        ? (parseFloat(sizeInput || '0')).toFixed(2)
                        : (parseFloat(priceInput || '0') * parseFloat(sizeInput || '0')).toFixed(2)
                      } USDC
                    </span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-[8px] text-slate-600 font-bold uppercase">{content.execution.takerFee}</span>
                    <span className="text-slate-400 text-[10px] font-mono">
                      {orderType === 'market'
                        ? (parseFloat(sizeInput || '0') * 0.002).toFixed(4)
                        : (parseFloat(priceInput || '0') * parseFloat(sizeInput || '0') * 0.002).toFixed(4)
                      }
                    </span>
                  </div>
                </div>

                <Button 
                  onClick={handleExecuteTrade}
                  className={cn(
                    "w-full font-bold uppercase text-[11px] tracking-widest py-3 transition-all",
                    tradeMode === 'buy' ? "btn-buy" : "btn-sell"
                  )}
                >
                  {orderType === 'market' 
                    ? `${content.execution.executeMarket} ${tradeMode === 'buy' ? 'Buy' : 'Sell'}`
                    : `${content.execution.placeLimit} ${tradeMode === 'buy' ? 'Buy' : 'Sell'}`
                  }
                </Button>
              </div>
            </div>

            <div className="divider-gradient" />

            {/* Active Orders */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2">
                  <Clock className="w-3 h-3" />
                  {content.activeOrders.title}
                </h3>
                <button className="text-[9px] text-slate-600 hover:text-rose-400 transition-colors uppercase font-bold">{content.activeOrders.clearAll}</button>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-2 no-scrollbar">
                {/* Optimistic Orders */}
                {optimisticOrders.map(order => (
                  <div key={order.id} className="p-2 rounded bg-cyan-500/5 border border-cyan-500/20 flex justify-between items-center animate-pulse">
                    <div className="flex flex-col">
                      <span className={cn("text-[10px] font-bold", order.side === 'buy' ? "text-emerald-400" : "text-rose-400")}>
                        {order.side === 'buy' ? 'BUY' : 'SELL'} {order.price.toFixed(4)}
                      </span>
                      <span className="text-[9px] text-slate-500 font-mono">{order.size} SHARES</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <RefreshCw className="w-3 h-3 text-cyan-500 animate-spin" />
                      <X className="w-3 h-3 text-slate-700 hover:text-rose-500 cursor-pointer" />
                    </div>
                  </div>
                ))}

                {/* Real Orders Placeholder */}
                {optimisticOrders.length === 0 && (
                  <div className="h-32 flex flex-col items-center justify-center text-slate-700 opacity-50 italic">
                    <BarChart3 className="w-8 h-8 mb-2" />
                    <span className="text-[10px]">{content.activeOrders.empty}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Bar: Quick Keyboard Help */}
          <div className="h-8 bg-slate-900 border-t border-slate-800 flex items-center px-4 gap-4 text-[9px] text-slate-600 font-mono shrink-0">
            <span className="flex items-center gap-1"><span className="kbd">[B]</span> {content.shortcuts.buy}</span>
            <span className="flex items-center gap-1"><span className="kbd">[S]</span> {content.shortcuts.sell}</span>
            <span className="flex items-center gap-1"><span className="kbd">[↑↓]</span> {content.shortcuts.price}</span>
            <span className="flex items-center gap-1"><span className="kbd">[?]</span> {content.shortcuts.shortcuts}</span>
            <div className="flex-1" />
            <span className="text-cyan-500/50">{content.shortcuts.terminal}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pro;
