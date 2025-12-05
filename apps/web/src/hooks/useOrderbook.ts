import { useReadContract, usePublicClient } from 'wagmi';
import { SOOTH_MARKET_ABI } from '../config/abis';
import { useDeployments } from './useDeployments';
import { useMarket } from './useMarket';
import { useState, useEffect, useCallback } from 'react';
import { formatUnits } from 'viem';

export interface Order {
  id: string;
  maker: string;
  outcome: number; // 0 = YES, 1 = NO
  price: string;
  amount: string;
  timestamp: number;
  type: 'ask'; // Currently only asks (sell orders) are supported directly
}

export function useOrderbook(marketId: string) {
  const { market } = useMarket(marketId);
  const deployments = useDeployments();
  const publicClient = usePublicClient();
  
  const [orders, setOrders] = useState<{ yes: Order[], no: Order[] }>({ yes: [], no: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number>(0);
  const [isSupported, setIsSupported] = useState<boolean>(true);

  const contractAddress = market?.contractAddress;

  const fetchOrderbook = useCallback(async (isBackground = false) => {
    if (!contractAddress || !publicClient) return;

    if (!isBackground) setIsLoading(true);
    try {
      const fetchSide = async (outcome: 0 | 1) => {
        const sideOrders: Order[] = [];
        console.log(`[Orderbook] Fetching bestOrder for outcome ${outcome} at ${contractAddress}`);
        
        let currentId = await publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: SOOTH_MARKET_ABI,
          functionName: 'bestOrder',
          args: [BigInt(outcome)]
        });

        console.log(`[Orderbook] Best order ID for outcome ${outcome}:`, currentId);

        let depth = 0;
        const MAX_DEPTH = 10;

        // Safety break: Check if currentId is 0 or if we've hit max depth
        while (currentId && currentId !== 0n && depth < MAX_DEPTH) {
          console.log(`[Orderbook] Fetching order ${currentId} (depth ${depth})`);
          
          const orderData = await publicClient.readContract({
            address: contractAddress as `0x${string}`,
            abi: SOOTH_MARKET_ABI,
            functionName: 'orders',
            args: [currentId]
          });

          // orderData: [id, maker, outcome, price, amount, timestamp]
          if (orderData) {
            const amount = orderData[4] as bigint;
            // Only include orders with non-zero amount
            if (amount > 0n) {
              console.log(`[Orderbook] Order ${currentId} data:`, orderData);
              sideOrders.push({
                id: orderData[0].toString(),
                maker: orderData[1],
                outcome: orderData[2],
                price: formatUnits(orderData[3], 18),
                amount: formatUnits(amount, 18),
                timestamp: Number(orderData[5]),
                type: 'ask'
              });
            }
          }

          const nextId = await publicClient.readContract({
            address: contractAddress as `0x${string}`,
            abi: SOOTH_MARKET_ABI,
            functionName: 'nextOrder',
            args: [currentId]
          });

          console.log(`[Orderbook] Next order ID after ${currentId}:`, nextId);

          // Prevent infinite loop if nextOrder returns same ID (shouldn't happen in correct contract, but safety first)
          if (nextId === currentId) {
            console.warn(`[Orderbook] Infinite loop detected at ID ${currentId}`);
            break;
          }
          currentId = nextId;
          
          depth++;
        }
        return sideOrders;
      };

      const [yesOrders, noOrders] = await Promise.all([
        fetchSide(0),
        fetchSide(1)
      ]);

      setOrders({ yes: yesOrders, no: noOrders });
      setLastUpdated(Date.now());
      setIsSupported(true);
    } catch (err: any) {
      console.error('Failed to fetch orderbook:', err);
      // Check for revert error indicating function doesn't exist or failed
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

  // Poll every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => fetchOrderbook(true), 60000);
    return () => clearInterval(interval);
  }, [fetchOrderbook]);

  return {
    orders,
    isLoading,
    lastUpdated,
    isSupported,
    refetch: fetchOrderbook
  };
}
