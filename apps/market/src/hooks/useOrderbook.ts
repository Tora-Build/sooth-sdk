import { useCallback, useEffect, useState } from 'react';
import { usePublicClient } from 'wagmi';
import { type Address, formatUnits } from 'viem';
import { fetchFromIndexer } from './indexer/config';
import { SOOTH_BOOK_ABI } from '../config/abis';
import { getDeployment } from '../config/deployments';



export interface OrderLevel {
  tick: number;
  yesPrice: number; // YES probability (0-1)
  amount: string; // Formatted WAD (human readable)
  side: 'bid' | 'ask';
}

export interface OrderbookData {
  bids: OrderLevel[]; // YES buyers (ordered desc by tick)
  asks: OrderLevel[]; // NO buyers (ordered asc by tick)
  isLoading: boolean;
  isError: boolean;
  lastUpdated: number;
  refetch: () => void;
}

interface RawIndexerOrder {
  side: number; // 0=NO, 1=YES
  tick: number; // 1-999
  amount: string; // WAD string
  maker: string; // address
}



const CHAIN_ID = 84532;
const REFRESH_INTERVAL = 10_000; // 10s
const RPC_BATCH_SIZE = 120;



function aggregateByTick(
  orders: RawIndexerOrder[],
): Map<string, { tick: number; totalWad: bigint; side: number }> {
  const map = new Map<string, { tick: number; totalWad: bigint; side: number }>();
  for (const o of orders) {
    const key = `${o.side}:${o.tick}`;
    const existing = map.get(key);
    const amt = BigInt(o.amount);
    if (existing) {
      existing.totalWad += amt;
    } else {
      map.set(key, { tick: o.tick, totalWad: amt, side: o.side });
    }
  }
  return map;
}

function toOrderLevels(
  aggregated: Map<string, { tick: number; totalWad: bigint; side: number }>,
): { bids: OrderLevel[]; asks: OrderLevel[] } {
  const bids: OrderLevel[] = [];
  const asks: OrderLevel[] = [];

  for (const entry of aggregated.values()) {
    if (entry.totalWad <= 0n) continue;
    const level: OrderLevel = {
      tick: entry.tick,
      yesPrice: entry.side === 1 ? entry.tick / 1000 : (1000 - entry.tick) / 1000,
      amount: formatUnits(entry.totalWad, 18),
      side: entry.side === 1 ? 'bid' : 'ask',
    };
    if (entry.side === 1) {
      bids.push(level);
    } else {
      asks.push(level);
    }
  }

  // Bids: YES buyers sorted descending by tick (highest YES price first)
  bids.sort((a, b) => b.tick - a.tick);
  // Asks: NO buyers sorted ascending by tick (lowest implied YES price first)
  asks.sort((a, b) => a.tick - b.tick);

  return { bids, asks };
}



type PublicClient = NonNullable<ReturnType<typeof usePublicClient>>;

async function scanTicksFromRpc(
  publicClient: PublicClient,
  soothBookAddress: Address,
  marketKey: `0x${string}`,
  side: 0 | 1,
): Promise<OrderLevel[]> {
  const ticks: number[] = [];
  for (let t = 1; t <= 999; t++) ticks.push(t);

  const levels: OrderLevel[] = [];

  for (let start = 0; start < ticks.length; start += RPC_BATCH_SIZE) {
    const batch = ticks.slice(start, start + RPC_BATCH_SIZE);
    const contracts = batch.map((tick) => ({
      address: soothBookAddress,
      abi: SOOTH_BOOK_ABI,
      functionName: 'getOrdersAtTick' as const,
      args: [marketKey, side, tick] as const,
    }));

    const results = await publicClient.multicall({ contracts });

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const tick = batch[i];
      if (!result || result.status !== 'success') continue;

      // getOrdersAtTick returns (address[] makers, uint256[] amounts)
      const [, amounts] = result.result as readonly [readonly Address[], readonly bigint[]];
      if (!amounts || amounts.length === 0) continue;

      const totalAmount = amounts.reduce((sum, a) => sum + a, 0n);
      if (totalAmount <= 0n) continue;

      levels.push({
        tick,
        yesPrice: side === 1 ? tick / 1000 : (1000 - tick) / 1000,
        amount: formatUnits(totalAmount, 18),
        side: side === 1 ? 'bid' : 'ask',
      });
    }
  }

  return levels;
}



export function useOrderbook(marketKey?: string): OrderbookData {
  const [bids, setBids] = useState<OrderLevel[]>([]);
  const [asks, setAsks] = useState<OrderLevel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(0);

  const publicClient = usePublicClient();
  const deployment = getDeployment(CHAIN_ID);
  const soothBookAddress = deployment?.SoothBook as Address | undefined;

  const fetchOrderbook = useCallback(
    async (background = false) => {
      if (!marketKey) return;

      if (!background) setIsLoading(true);
      setIsError(false);

      try {
        // 1) Try indexer first
        const raw = await fetchFromIndexer<RawIndexerOrder[]>(
          `/v12/orders/${CHAIN_ID}/${marketKey}`,
        );

        if (raw && Array.isArray(raw) && raw.length > 0) {
          const aggregated = aggregateByTick(raw);
          const { bids: b, asks: a } = toOrderLevels(aggregated);
          setBids(b);
          setAsks(a);
          setLastUpdated(Date.now());
          return;
        }

        // 2) Fallback to RPC multicall if indexer is unavailable
        if (publicClient && soothBookAddress && marketKey.startsWith('0x')) {
          const mk = marketKey as `0x${string}`;
          const [rpcBids, rpcAsks] = await Promise.all([
            scanTicksFromRpc(publicClient, soothBookAddress, mk, 1),
            scanTicksFromRpc(publicClient, soothBookAddress, mk, 0),
          ]);
          rpcBids.sort((a, b) => b.tick - a.tick);
          rpcAsks.sort((a, b) => a.tick - b.tick);
          setBids(rpcBids);
          setAsks(rpcAsks);
          setLastUpdated(Date.now());
          return;
        }

        // 3) Neither available — empty orderbook
        setBids([]);
        setAsks([]);
        setIsError(true);
      } catch {
        setIsError(true);
      } finally {
        if (!background) setIsLoading(false);
      }
    },
    [marketKey, publicClient, soothBookAddress],
  );

  // Initial fetch
  useEffect(() => {
    fetchOrderbook(false);
  }, [fetchOrderbook]);

  // Periodic refresh
  useEffect(() => {
    if (!marketKey) return;
    const id = setInterval(() => fetchOrderbook(true), REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [fetchOrderbook, marketKey]);

  const refetch = useCallback(() => {
    fetchOrderbook(false);
  }, [fetchOrderbook]);

  return { bids, asks, isLoading, isError, lastUpdated, refetch };
}
