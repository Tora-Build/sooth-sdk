import { usePublicClient, useAccount, useReadContracts } from 'wagmi';
import { MARKET_V4_ABI, TRADER_VAULT_V4_ABI } from '../config/abis';
import { useAmmMarket } from './useAmmMarket';
import { useAmmMarketByAddress } from './useAmmMarketByAddress';
import { useDeployments } from './useDeployments';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { formatUnits } from 'viem';
import marketsConfig from '../config/markets.json';

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
  // Detect if marketId is an address (0x...) or a config ID
  const isAddressFormat = marketId?.startsWith('0x') && marketId.length === 42;

  // Use useAmmMarketByAddress for dynamic V5 markets, useAmmMarket for config-based V4
  const { market: configMarket } = useAmmMarket(isAddressFormat ? '' : marketId);
  const { market: addressMarket } = useAmmMarketByAddress(
    isAddressFormat ? (marketId as `0x${string}`) : undefined
  );
  const market = isAddressFormat ? addressMarket : configMarket;

  const { address } = useAccount();
  const { config } = useDeployments();
  const deployments = config.contracts;
  const traderVaultAddress = deployments.SoothTraderVault as `0x${string}`;
  const publicClient = usePublicClient();

  const [orderbook, setOrderbook] = useState<OrderbookState>({ bids: [], asks: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number>(0);
  const [isSupported, setIsSupported] = useState<boolean>(true);

  // For address-format markets, use the marketId directly as the contract address
  const contractAddress = isAddressFormat ? (marketId as `0x${string}`) : market?.contractAddress;

  // Fetch User Balances (Custodial - From Vault)
  const { data: shareBalances, refetch: refetchBalances } = useReadContracts({
    contracts: [
      {
        address: traderVaultAddress,
        abi: TRADER_VAULT_V4_ABI,
        functionName: 'shareBalances',
        args: [address || '0x0000000000000000000000000000000000000000', contractAddress, 0] // YES
      },
      {
        address: traderVaultAddress,
        abi: TRADER_VAULT_V4_ABI,
        functionName: 'shareBalances',
        args: [address || '0x0000000000000000000000000000000000000000', contractAddress, 1] // NO
      }
    ],
    query: {
      enabled: !!address && !!contractAddress && !!traderVaultAddress,
      refetchInterval: 5000
    }
  });

  const userYesShares = shareBalances?.[0]?.result ? parseFloat(formatUnits(shareBalances[0].result as bigint, 18)) : 0;
  const userNoShares = shareBalances?.[1]?.result ? parseFloat(formatUnits(shareBalances[1].result as bigint, 18)) : 0;

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

        try {
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
            }) as [string, number, bigint, bigint, boolean] | undefined;

            if (orderData) {
              // OrderV4: [maker, outcome, yesPrice, amount, isBuySide]
              if (Array.isArray(orderData) && orderData.length >= 5) {
                const [maker, outcome, yesPrice, amount, isBuySide] = orderData;

                // Only include orders with non-zero amount
                if (amount > 0n) {
                  const yesPriceFormatted = formatUnits(yesPrice, 18);

                  // Lookup real owner from TraderVault (market maker is always vault)
                  let realOwner = maker;
                  try {
                    const owner = await publicClient.readContract({
                      address: traderVaultAddress,
                      abi: TRADER_VAULT_V4_ABI,
                      functionName: 'orderOwners',
                      args: [currentId]
                    }) as `0x${string}`;
                    if (owner && owner !== '0x0000000000000000000000000000000000000000') {
                      realOwner = owner;
                    }
                  } catch (e) {
                    // Fallback to maker if lookup fails
                  }

                  sideOrders.push({
                    id: currentId.toString(),
                    maker: realOwner,
                    yesPrice: yesPriceFormatted,
                    displayPrice: yesPriceFormatted, // For YES view; caller can convert for NO view
                    amount: formatUnits(amount, 18), // Normalize to 18 decimals
                    timestamp: 0, // V4 doesn't store timestamp
                    isBuySide,
                    side,
                  });
                }
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
        } catch (err) {
          console.error(`[Orderbook] Error fetching ${side} orders: `, err);
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
    refetch: () => { fetchOrderbook(); refetchBalances(); },
    userYesShares,
    userNoShares,
  };
}
