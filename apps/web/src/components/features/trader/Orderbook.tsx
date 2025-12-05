import React, { useState, useEffect } from 'react';
import { useOrderbook } from '../../../hooks/useOrderbook';
import { useLimitOrder } from '../../../hooks/useLimitOrder';
import { useAccount } from 'wagmi';
import { Card } from '../../ui/Card';
import { cn } from '../../../lib/utils';
import { RefreshCw, Trash2, User } from 'lucide-react';

interface OrderbookProps {
  marketId: string;
  selectedOutcome?: 0 | 1; // Optional initial outcome
}

export const Orderbook: React.FC<OrderbookProps> = ({ marketId, selectedOutcome: propOutcome = 0 }) => {
  const [selectedOutcome, setSelectedOutcome] = useState<0 | 1>(propOutcome);
  const [viewMode, setViewMode] = useState<'book' | 'my-orders'>('book');
  const { orders, isLoading, refetch, isSupported } = useOrderbook(marketId);
  const { cancelOrder, isPending: isCancelling } = useLimitOrder(marketId);
  const { address } = useAccount();

  // Sync with prop changes
  useEffect(() => {
    setSelectedOutcome(propOutcome);
  }, [propOutcome]);

  if (!isSupported) {
    return (
      <Card className="p-4 border-amber-500/20 bg-amber-500/5">
        <h3 className="font-heading font-semibold text-sm text-amber-500 mb-2">Orderbook Not Available</h3>
        <p className="text-xs text-amber-200/70">
          This market contract is outdated and does not support the orderbook feature. Please redeploy the markets to use this feature.
        </p>
      </Card>
    );
  }

  // Filter My Orders
  const myOrders = [
    ...orders.yes.map(o => ({ ...o, outcomeLabel: 'YES' })),
    ...orders.no.map(o => ({ ...o, outcomeLabel: 'NO' }))
  ].filter(o => o.maker.toLowerCase() === address?.toLowerCase());

  // Derived Bids/Asks based on selected outcome
  const asks = selectedOutcome === 0 ? orders.yes : orders.no;
  const bids = (selectedOutcome === 0 ? orders.no : orders.yes).map(order => ({
    ...order,
    price: (1 - parseFloat(order.price)).toFixed(2), // Invert price
    type: 'bid'
  }));

  // Sort Asks: Lowest Price First (Best Ask)
  const sortedAsks = [...asks].sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
  
  // Sort Bids: Highest Price First (Best Bid)
  const sortedBids = [...bids].sort((a, b) => parseFloat(b.price) - parseFloat(a.price));

  const OrderList = ({ items, type, colorClass, label }: { items: any[], type: string, colorClass: string, label: string }) => (
    <div className="flex-1 space-y-2">
      <h4 className={cn("text-xs font-semibold uppercase tracking-wider mb-2", colorClass)}>
        {label}
      </h4>
      <div className="space-y-1">
        <div className="grid grid-cols-2 text-[10px] text-slate-500 px-2 mb-1">
          <span>Price</span>
          <span className="text-right">Amount</span>
        </div>
        {items.length === 0 ? (
          <div className="text-xs text-slate-600 text-center py-4 italic">
            No orders
          </div>
        ) : (
          items.map((order) => (
            <div 
              key={order.id} 
              className={cn(
                "grid grid-cols-2 text-xs px-2 py-1.5 rounded transition-colors cursor-default",
                order.maker.toLowerCase() === address?.toLowerCase() ? "bg-indigo-500/10 border border-indigo-500/30" : "hover:bg-slate-800/50"
              )}
            >
              <span className={cn("font-mono font-medium", colorClass)}>
                {Number(order.price).toFixed(2)}
              </span>
              <span className="text-right font-mono text-slate-300">
                {Number(order.amount).toFixed(2)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const MyOrdersList = () => (
    <div className="space-y-2">
      <div className="grid grid-cols-4 text-[10px] text-slate-500 px-2 mb-1">
        <span>Side</span>
        <span>Price</span>
        <span className="text-right">Amount</span>
        <span className="text-right">Action</span>
      </div>
      {myOrders.length === 0 ? (
        <div className="text-xs text-slate-600 text-center py-8 italic">
          You have no active orders
        </div>
      ) : (
        myOrders.map((order) => (
          <div 
            key={order.id} 
            className="grid grid-cols-4 items-center text-xs px-2 py-2 rounded bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-colors"
          >
            <span className={cn(
              "font-bold text-[10px]",
              order.outcomeLabel === 'YES' ? "text-emerald-400" : "text-rose-400"
            )}>
              SELL {order.outcomeLabel}
            </span>
            <span className="font-mono text-slate-300">
              {Number(order.price).toFixed(2)}
            </span>
            <span className="text-right font-mono text-slate-300">
              {Number(order.amount).toFixed(2)}
            </span>
            <div className="text-right">
              <button
                onClick={async () => {
                  await cancelOrder(order.id);
                  refetch();
                }}
                disabled={isCancelling}
                className="p-1.5 rounded bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors"
                title="Cancel Order"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );

  if (isLoading && orders.yes.length === 0 && orders.no.length === 0) {
    return (
      <Card className="p-4 animate-pulse">
        <div className="h-4 w-24 bg-slate-800 rounded mb-4"></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="h-3 w-full bg-slate-800/50 rounded"></div>
            <div className="h-3 w-full bg-slate-800/50 rounded"></div>
          </div>
          <div className="space-y-2">
            <div className="h-3 w-full bg-slate-800/50 rounded"></div>
            <div className="h-3 w-full bg-slate-800/50 rounded"></div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-heading font-semibold text-sm text-slate-300">Orderbook</h3>
          {/* View Toggle */}
          <div className="flex gap-1 bg-slate-900/50 rounded p-0.5 border border-slate-800 ml-2">
            <button
              onClick={() => setViewMode('book')}
              className={cn(
                "px-2 py-0.5 text-[10px] font-semibold rounded transition-all",
                viewMode === 'book'
                  ? "bg-indigo-500/20 text-indigo-400"
                  : "text-slate-500 hover:text-slate-300"
              )}
            >
              Book
            </button>
            <button
              onClick={() => setViewMode('my-orders')}
              className={cn(
                "px-2 py-0.5 text-[10px] font-semibold rounded transition-all flex items-center gap-1",
                viewMode === 'my-orders'
                  ? "bg-indigo-500/20 text-indigo-400"
                  : "text-slate-500 hover:text-slate-300"
              )}
            >
              My Orders
              {myOrders.length > 0 && (
                <span className="bg-indigo-500 text-white text-[8px] px-1 rounded-full">
                  {myOrders.length}
                </span>
              )}
            </button>
          </div>
        </div>
        <button 
          onClick={() => refetch(false)} 
          disabled={isLoading}
          className={cn("p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-colors", isLoading && "animate-spin")}
          title="Refresh Orderbook"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {viewMode === 'book' ? (
        <>
          {/* Outcome Toggle (Only visible in Book mode) */}
          <div className="flex justify-center mb-4">
             <div className="flex gap-1 bg-slate-900/50 rounded p-0.5 border border-slate-800">
                <button
                  onClick={() => setSelectedOutcome(0)}
                  className={cn(
                    "px-3 py-1 text-[10px] font-semibold rounded transition-all",
                    selectedOutcome === 0
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  YES
                </button>
                <button
                  onClick={() => setSelectedOutcome(1)}
                  className={cn(
                    "px-3 py-1 text-[10px] font-semibold rounded transition-all",
                    selectedOutcome === 1
                      ? "bg-rose-500/20 text-rose-400"
                      : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  NO
                </button>
              </div>
          </div>

          <div className="flex gap-4">
            {/* Bids */}
            <OrderList 
              items={sortedBids} 
              type="bid" 
              colorClass="text-emerald-400" 
              label="Bids"
            />
            <div className="w-px bg-slate-800 self-stretch"></div>
            {/* Asks */}
            <OrderList 
              items={sortedAsks} 
              type="ask" 
              colorClass="text-rose-400" 
              label="Asks"
            />
          </div>
        </>
      ) : (
        <MyOrdersList />
      )}
    </Card>
  );
};
