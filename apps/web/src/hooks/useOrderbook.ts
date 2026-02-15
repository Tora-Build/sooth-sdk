import { usePublicClient } from 'wagmi';
import { MARKET_V4_ABI } from '../config/abis';
import { useAmmMarket } from './useAmmMarket';
import { useAmmMarketByAddress } from './useAmmMarketByAddress';
import { useState, useEffect, useCallback } from 'react';
import { formatUnits } from 'viem';

export interface Order {
  id: string;
  maker: string;
  yesPrice: string;
  displayPrice: string;
  amount: string;
  timestamp: number;
  isBuySide: boolean;
  side: 'bid' | 'ask';
}

export interface OrderbookState {
  bids: Order[];
  asks: Order[];
}

export function useOrderbook(marketId: string) {
  const isAddressFormat = marketId?.startsWith('0x') && marketId.length === 42;

  const { amm: configMarket } = useAmmMarket(
    isAddressFormat ? undefined : (marketId as `0x${string}` | undefined)
  );
  const { market: addressMarket } = useAmmMarketByAddress(
    isAddressFormat ? (marketId as `0x${string}`) : undefined
  );
  const market = isAddressFormat ? addressMarket : configMarket;

  const publicClient = usePublicClient();

  const [orderbook, setOrderbook] = useState<OrderbookState>({ bids: [], asks: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number>(0);
  const [isSupported, setIsSupported] = useState<boolean>(true);

  const contractAddress = isAddressFormat
    ? (marketId as `0x${string}`)
    : ((market as any)?.contractAddress || (market as any)?.address);

  const fetchOrderbook = useCallback(
    async (isBackground = false) => {
      if (!contractAddress || !publicClient) return;

      if (!isBackground) setIsLoading(true);
      try {
        const fetchSide = async (startFn: 'bestAsk' | 'bestBid', side: 'ask' | 'bid') => {
          const sideOrders: Order[] = [];

          try {
            let currentIdResult: bigint | null = null;
            try {
              currentIdResult = (await publicClient.readContract({
                address: contractAddress as `0x${string}`,
                abi: MARKET_V4_ABI,
                functionName: startFn,
              })) as bigint;
            } catch {
              return sideOrders;
            }

            let currentId = currentIdResult;
            let depth = 0;
            const maxDepth = 20;
            const visitedIds = new Set<string>();

            while (depth < maxDepth) {
              const idKey = currentId.toString();
              if (visitedIds.has(idKey)) break;
              visitedIds.add(idKey);

              const orderData = (await publicClient
                .readContract({
                  address: contractAddress as `0x${string}`,
                  abi: MARKET_V4_ABI,
                  functionName: 'orders',
                  args: [currentId],
                })
                .catch(() => null)) as [string, number, bigint, bigint, boolean] | undefined | null;

              if (!orderData || !Array.isArray(orderData) || orderData.length < 5) break;

              const [maker, _outcome, yesPrice, amount, isBuySide] = orderData;

              if (maker === '0x0000000000000000000000000000000000000000') break;

              if (amount > 0n) {
                const yesPriceFormatted = formatUnits(yesPrice, 18);
                sideOrders.push({
                  id: currentId.toString(),
                  maker,
                  yesPrice: yesPriceFormatted,
                  displayPrice: yesPriceFormatted,
                  amount: formatUnits(amount, 18),
                  timestamp: 0,
                  isBuySide,
                  side,
                });
              }

              const nextId = (await publicClient
                .readContract({
                  address: contractAddress as `0x${string}`,
                  abi: MARKET_V4_ABI,
                  functionName: 'nextOrder',
                  args: [currentId],
                })
                .catch(() => null)) as bigint | null;

              if (nextId === null) break;
              if (nextId === 0n) break;

              currentId = nextId;
              depth++;
            }
          } catch {
            return sideOrders;
          }

          return sideOrders;
        };

        const [asks, bids] = await Promise.all([fetchSide('bestAsk', 'ask'), fetchSide('bestBid', 'bid')]);

        setOrderbook({ bids, asks });
        setLastUpdated(Date.now());
        setIsSupported(true);
      } catch (err: any) {
        if (err.message?.includes('reverted') || err.message?.includes('function selector')) {
          setIsSupported(false);
        }
      } finally {
        if (!isBackground) setIsLoading(false);
      }
    },
    [contractAddress, publicClient]
  );

  useEffect(() => {
    fetchOrderbook(false);
  }, [fetchOrderbook]);

  useEffect(() => {
    const interval = setInterval(() => fetchOrderbook(true), 5000);
    return () => clearInterval(interval);
  }, [fetchOrderbook]);

  const getOrdersForOutcome = (outcome: 0 | 1) => {
    if (outcome === 0) {
      return { bids: orderbook.bids, asks: orderbook.asks };
    }

    return {
      bids: orderbook.asks.map((o) => ({
        ...o,
        displayPrice: (1 - parseFloat(o.yesPrice)).toFixed(4),
        side: 'bid' as const,
      })),
      asks: orderbook.bids.map((o) => ({
        ...o,
        displayPrice: (1 - parseFloat(o.yesPrice)).toFixed(4),
        side: 'ask' as const,
      })),
    };
  };

  return {
    orderbook,
    bids: orderbook.bids,
    asks: orderbook.asks,
    getOrdersForOutcome,
    isLoading,
    lastUpdated,
    isSupported,
    refetch: () => {
      fetchOrderbook();
    },
    userYesShares: 0,
    userNoShares: 0,
  };
}
