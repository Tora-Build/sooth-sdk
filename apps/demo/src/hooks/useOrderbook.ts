import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { SOOTHBOOK_ABI, ERC20_ABI } from '../config/abis';
import { useAmmMarket } from './useAmmMarket';
import { useAmmMarketByAddress } from './useAmmMarketByAddress';
import { encodePacked, formatUnits, isAddress, keccak256 } from 'viem';
import { useDeployments } from './useDeployments';

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
  const { address: userAddress } = useAccount();
  const { contracts } = useDeployments();

  const { amm: configMarket } = useAmmMarket(
    isAddressFormat ? undefined : (marketId as `0x${string}` | undefined)
  );
  const { market: addressMarket } = useAmmMarketByAddress(
    isAddressFormat ? (marketId as `0x${string}`) : undefined
  );
  const market = isAddressFormat ? addressMarket : configMarket;

  const publicClient = usePublicClient();
  const soothBookAddress = contracts.SoothBook as `0x${string}` | undefined;

  const [orderbook, setOrderbook] = useState<OrderbookState>({ bids: [], asks: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number>(0);
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [userYesShares, setUserYesShares] = useState(0);
  const [userNoShares, setUserNoShares] = useState(0);
  const [yesTokenAddress, setYesTokenAddress] = useState<`0x${string}` | undefined>(undefined);
  const [noTokenAddress, setNoTokenAddress] = useState<`0x${string}` | undefined>(undefined);

  const marketAddress = isAddressFormat
    ? (marketId as `0x${string}`)
    : (((market as { contractAddress?: string; address?: string } | null)?.contractAddress ||
        (market as { contractAddress?: string; address?: string } | null)?.address) as
        | `0x${string}`
        | undefined);

  const marketKey = useMemo(() => {
    if (!marketAddress || !isAddress(marketAddress)) return undefined;
    return keccak256(encodePacked(['address'], [marketAddress]));
  }, [marketAddress]);

  const scanTickDepth = useCallback(
    async (side: 0 | 1, blockNumber: bigint): Promise<Order[]> => {
      if (!publicClient || !soothBookAddress || !marketKey) {
        return [];
      }

      const maxTickCalls = 999;
      const batchSize = 120;
      const ticks: number[] = [];
      for (let tick = 999; tick >= 1 && ticks.length < maxTickCalls; tick--) {
        ticks.push(tick);
      }
      const orders: Order[] = [];

      for (let start = 0; start < ticks.length; start += batchSize) {
        const batchTicks = ticks.slice(start, start + batchSize);
        const contracts = batchTicks.map((tick) => ({
          address: soothBookAddress,
          abi: SOOTHBOOK_ABI,
          functionName: 'getOrdersAtTick' as const,
          args: [marketKey, side, tick] as const,
        }));
        const results = await publicClient.multicall({ contracts, blockNumber });

        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          const tick = batchTicks[i];
          if (!result || result.status !== 'success') continue;

          const [totalAmount] = result.result as readonly [bigint, bigint];
          if (totalAmount <= 0n) continue;

          const yesPriceValue = side === 1 ? tick / 1000 : (1000 - tick) / 1000;
          const yesPrice = yesPriceValue.toFixed(4);

          orders.push({
            id: `${side}:${tick}`,
            maker: 'aggregated',
            yesPrice,
            displayPrice: yesPrice,
            amount: formatUnits(totalAmount, 18),
            timestamp: 0,
            isBuySide: side === 1,
            side: side === 1 ? 'bid' : 'ask',
          });
        }
      }

      return orders;
    },
    [marketKey, publicClient, soothBookAddress]
  );

  const fetchOrderbook = useCallback(
    async (isBackground = false) => {
      if (!soothBookAddress || !marketKey || !publicClient) return;

      if (!isBackground) setIsLoading(true);
      try {
        const snapshotBlock = await publicClient.getBlockNumber();

        const [marketRes] = await publicClient.multicall({
          contracts: [
            {
              address: soothBookAddress,
              abi: SOOTHBOOK_ABI,
              functionName: 'markets' as const,
              args: [marketKey] as const,
            },
          ],
          blockNumber: snapshotBlock,
        });

        if (marketRes.status !== 'success') {
          setIsSupported(false);
          return;
        }
        const [
          _collateral,
          yesToken,
          noToken,
          _active,
          _finalized,
          _outcome,
        ] = marketRes.result as readonly [
          `0x${string}`,
          `0x${string}`,
          `0x${string}`,
          boolean,
          boolean,
          number,
        ];

        setYesTokenAddress(yesToken);
        setNoTokenAddress(noToken);

        const [bids, asks] = await Promise.all([
          scanTickDepth(1, snapshotBlock),
          scanTickDepth(0, snapshotBlock),
        ]);

        if (userAddress && isAddress(yesToken) && isAddress(noToken)) {
          const [yesBalRes, noBalRes] = await publicClient.multicall({
            contracts: [
              {
                address: yesToken,
                abi: ERC20_ABI,
                functionName: 'balanceOf',
                args: [userAddress],
              },
              {
                address: noToken,
                abi: ERC20_ABI,
                functionName: 'balanceOf',
                args: [userAddress],
              },
            ],
            blockNumber: snapshotBlock,
          });

          const yesBal = yesBalRes.status === 'success' ? yesBalRes.result : 0n;
          const noBal = noBalRes.status === 'success' ? noBalRes.result : 0n;
          setUserYesShares(parseFloat(formatUnits(yesBal as bigint, 18)));
          setUserNoShares(parseFloat(formatUnits(noBal as bigint, 18)));
        } else {
          setUserYesShares(0);
          setUserNoShares(0);
        }

        setOrderbook({ bids, asks });
        setLastUpdated(Date.now());
        setIsSupported(true);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : '';
        if (message.includes('reverted') || message.includes('function selector')) {
          setIsSupported(false);
        }
      } finally {
        if (!isBackground) setIsLoading(false);
      }
    },
    [marketKey, publicClient, scanTickDepth, soothBookAddress, userAddress]
  );

  useEffect(() => {
    fetchOrderbook(false);
  }, [fetchOrderbook]);

  useEffect(() => {
    const interval = setInterval(() => fetchOrderbook(true), 10000);
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
    userYesShares,
    userNoShares,
    yesTokenAddress,
    noTokenAddress,
  };
}
