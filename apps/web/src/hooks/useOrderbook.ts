import { usePublicClient } from 'wagmi';
import { MARKET_V4_ABI } from '../config/abis';
import { useMarket } from './useMarket';
import { useState, useEffect, useCallback } from 'react';
import { formatUnits } from 'viem';

/**
 * V3 Unified Orderbook Order
 * All orders are stored normalized to YES price internally.
 * isBuySide = true means the maker wants YES tokens.
 * isBuySide = false means the maker wants NO tokens (i.e., they're "selling" YES).
 */
export interface Order {
  id: string;
  maker: string;
  yesPrice: string;        // Normalized YES price (0-1)
  displayPrice: string;    // Price shown to user based on viewing side
  amount: string;
  timestamp: number;
  isBuySide: boolean;      // true = wants YES, false = wants NO
  side: 'bid' | 'ask';     // bid = wants to buy YES, ask = wants to sell YES
}

export interface OrderbookState {
  bids: Order[];  // Buy YES orders (sorted by yesPrice DESC)
  asks: Order[];  // Sell YES orders (sorted by yesPrice ASC)
}

export function useOrderbook(marketId: string) {
  const { market } = useMarket(marketId);
  const publicClient = usePublicClient();

  const [orderbook, setOrderbook] = useState<OrderbookState>({ bids: [], asks: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number>(0);
  const [isSupported, setIsSupported] = useState<boolean>(true);

  const contractAddress = market?.contractAddress;

  const fetchOrderbook = useCallback(async (isBackground = false) => {
    if (!contractAddress || !publicClient) return;

    if (!isBackground) setIsLoading(true);
    try {
      /**
       * V3 Unified Orderbook:
       * - bestAsk = lowest yesPrice (best for YES buyers)
       * - bestBid = highest yesPrice (best for NO buyers / YES sellers)
       * 
       * Asks: isBuySide = false (makers want NO, so they're "selling" YES)
       * Bids: isBuySide = true (makers want YES)
       */

      const fetchSide = async (startFn: 'bestAsk' | 'bestBid', side: 'ask' | 'bid') => {
        const sideOrders: Order[] = [];

        let currentId = await publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: MARKET_V4_ABI,
          functionName: startFn,
        });

        let depth = 0;
        const MAX_DEPTH = 20;

        while (currentId && currentId !== 0n && depth < MAX_DEPTH) {
          const orderData = await publicClient.readContract({
            address: contractAddress as `0x${string}`,
            abi: MARKET_V4_ABI,
            functionName: 'orders',
            args: [currentId]
          }) as [string, number, bigint, bigint, boolean];

          if (orderData) {
            // OrderV4: [maker, outcome, yesPrice, amount, isBuySide]
            const [maker, outcome, yesPrice, amount, isBuySide] = orderData;

            // Only include orders with non-zero amount
            if (amount > 0n) {
              const yesPriceFormatted = formatUnits(yesPrice, 18);

              sideOrders.push({
                id: currentId.toString(),
                maker,
                yesPrice: yesPriceFormatted,
                displayPrice: yesPriceFormatted, // For YES view; caller can convert for NO view
                amount: formatUnits(amount, 18),
                timestamp: 0, // V4 doesn't store timestamp
                isBuySide,
                side,
              });
            }
          }

          const nextId = await publicClient.readContract({
            address: contractAddress as `0x${string}`,
            abi: MARKET_V4_ABI,
            functionName: 'nextOrder',
            args: [currentId]
          });

          // Prevent infinite loop
          if (nextId === currentId) {
            console.warn(`[Orderbook] Infinite loop detected at ID ${currentId}`);
            break;
          }
          currentId = nextId;
          depth++;
        }
        return sideOrders;
      };

      const [asks, bids] = await Promise.all([
        fetchSide('bestAsk', 'ask'),
        fetchSide('bestBid', 'bid')
      ]);

      setOrderbook({ bids, asks });
      setLastUpdated(Date.now());
      setIsSupported(true);
    } catch (err: any) {
      console.error('Failed to fetch orderbook:', err);
      // Detailed error logging
      console.log('--- Orderbook Fetch Error ---');
      console.log('Contract:', contractAddress);
      console.log('Error Message:', err.message);
      console.log('Error Cause:', err.cause);
      console.log('-----------------------------');

      if (err.message?.includes('reverted') || err.message?.includes('function selector')) {
        setIsSupported(false);
      }
    } finally {
      if (!isBackground) setIsLoading(false);
    }
  }, [contractAddress, publicClient]);

  // Initial fetch
  useEffect(() => {
    fetchOrderbook(false);
  }, [fetchOrderbook]);

  // Poll every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => fetchOrderbook(true), 5000);
    return () => clearInterval(interval);
  }, [fetchOrderbook]);

  /**
   * Helper: Get orders for a specific outcome view
   * - For YES view: bids are buy orders, asks are sell orders
   * - For NO view: flip everything (bids become asks, prices inverted)
   */
  const getOrdersForOutcome = (outcome: 0 | 1) => {
    if (outcome === 0) {
      // YES view - direct mapping
      return { bids: orderbook.bids, asks: orderbook.asks };
    } else {
      // NO view - flip sides and invert prices
      return {
        bids: orderbook.asks.map(o => ({
          ...o,
          displayPrice: (1 - parseFloat(o.yesPrice)).toFixed(4),
          side: 'bid' as const,
        })),
        asks: orderbook.bids.map(o => ({
          ...o,
          displayPrice: (1 - parseFloat(o.yesPrice)).toFixed(4),
          side: 'ask' as const,
        })),
      };
    }
  };

  return {
    orderbook,
    bids: orderbook.bids,
    asks: orderbook.asks,
    getOrdersForOutcome,
    isLoading,
    lastUpdated,
    isSupported,
    refetch: fetchOrderbook
  };
}

