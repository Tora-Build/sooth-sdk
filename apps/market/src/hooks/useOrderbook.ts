import { useCallback, useEffect, useState } from 'react';
import { usePublicClient } from 'wagmi';
import { type Address, formatUnits } from 'viem';

import { SOOTH_BOOK_ABI } from '../config/abis';
import { getDeployment, getInstanceBySoothBook } from '../config/deployments';
import { DEFAULT_CHAIN_ID } from '../config/chains';
import { fetchFromIndexer } from './indexer/config';

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

const CHAIN_ID = DEFAULT_CHAIN_ID;
const REFRESH_INTERVAL = 10_000; // 10s
const SCAN_RADIUS = 50; // scan ±50 ticks around best tick

type PublicClient = NonNullable<ReturnType<typeof usePublicClient>>;

// ── Indexer-based fetch ─────────────────────────────────────────────────

interface IndexerOrder {
  side: number;
  tick: number;
  amount: string;
  status: string;
}

async function fetchFromIndexerApi(
  chainId: number,
  marketKey: string,
): Promise<{ bids: OrderLevel[]; asks: OrderLevel[] } | null> {
  const orders = await fetchFromIndexer<IndexerOrder[]>(
    `/v12/orders/${chainId}/${marketKey}`,
  );
  if (!orders || orders.length === 0) return null;

  const bids: OrderLevel[] = [];
  const asks: OrderLevel[] = [];

  // Aggregate by side+tick
  const agg = new Map<string, { tick: number; total: bigint; side: number }>();
  for (const o of orders) {
    if (o.status !== 'active') continue;
    const key = `${o.side}:${o.tick}`;
    const existing = agg.get(key);
    const amt = BigInt(o.amount);
    if (existing) {
      existing.total += amt;
    } else {
      agg.set(key, { tick: o.tick, total: amt, side: o.side });
    }
  }

  for (const entry of agg.values()) {
    if (entry.total <= 0n) continue;
    const level: OrderLevel = {
      tick: entry.tick,
      yesPrice: entry.side === 1 ? entry.tick / 1000 : (1000 - entry.tick) / 1000,
      amount: formatUnits(entry.total, 18),
      side: entry.side === 1 ? 'bid' : 'ask',
    };
    if (entry.side === 1) bids.push(level);
    else asks.push(level);
  }

  bids.sort((a, b) => b.tick - a.tick);
  asks.sort((a, b) => a.tick - b.tick);
  return { bids, asks };
}

// ── RPC-based fetch (fallback) ──────────────────────────────────────────

async function scanFromRpc(
  publicClient: PublicClient,
  soothBookAddress: Address,
  marketKey: `0x${string}`,
): Promise<{ bids: OrderLevel[]; asks: OrderLevel[] }> {
  // Step 1: Get best ticks for both sides
  const bestTickResults = await publicClient.multicall({
    contracts: [
      {
        address: soothBookAddress,
        abi: SOOTH_BOOK_ABI,
        functionName: 'getBestTick',
        args: [marketKey, 1], // YES side
      },
      {
        address: soothBookAddress,
        abi: SOOTH_BOOK_ABI,
        functionName: 'getBestTick',
        args: [marketKey, 0], // NO side
      },
    ],
  });

  const bestYesTick = bestTickResults[0]?.status === 'success' ? Number(bestTickResults[0].result) : 1000;
  const bestNoTick = bestTickResults[1]?.status === 'success' ? Number(bestTickResults[1].result) : 1000;

  const hasYesOrders = bestYesTick > 0 && bestYesTick < 1000;
  const hasNoOrders = bestNoTick > 0 && bestNoTick < 1000;

  if (!hasYesOrders && !hasNoOrders) {
    return { bids: [], asks: [] };
  }

  // Step 2: Scan around best ticks
  const ticksToScan: Array<{ tick: number; side: 0 | 1 }> = [];

  if (hasYesOrders) {
    const lo = Math.max(1, bestYesTick - SCAN_RADIUS);
    const hi = Math.min(999, bestYesTick + SCAN_RADIUS);
    for (let t = lo; t <= hi; t++) ticksToScan.push({ tick: t, side: 1 });
  }

  if (hasNoOrders) {
    const lo = Math.max(1, bestNoTick - SCAN_RADIUS);
    const hi = Math.min(999, bestNoTick + SCAN_RADIUS);
    for (let t = lo; t <= hi; t++) ticksToScan.push({ tick: t, side: 0 });
  }

  const contracts = ticksToScan.map(({ tick, side }) => ({
    address: soothBookAddress,
    abi: SOOTH_BOOK_ABI,
    functionName: 'getOrdersAtTick' as const,
    args: [marketKey, side, tick] as const,
  }));

  const results = await publicClient.multicall({ contracts });

  const bids: OrderLevel[] = [];
  const asks: OrderLevel[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const { tick, side } = ticksToScan[i];
    if (!result || result.status !== 'success') continue;

    const [totalAmount] = result.result as readonly [bigint, bigint];
    if (!totalAmount || totalAmount <= 0n) continue;

    const level: OrderLevel = {
      tick,
      yesPrice: side === 1 ? tick / 1000 : (1000 - tick) / 1000,
      amount: formatUnits(totalAmount, 18),
      side: side === 1 ? 'bid' : 'ask',
    };

    if (side === 1) bids.push(level);
    else asks.push(level);
  }

  bids.sort((a, b) => b.tick - a.tick);
  asks.sort((a, b) => a.tick - b.tick);
  return { bids, asks };
}

// ── Hook ────────────────────────────────────────────────────────────────

export function useOrderbook(
  marketKey?: string,
  instanceSoothBook?: string,
): OrderbookData {
  const [bids, setBids] = useState<OrderLevel[]>([]);
  const [asks, setAsks] = useState<OrderLevel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(0);

  const chainId = instanceSoothBook
    ? (getInstanceBySoothBook(instanceSoothBook)?.chainId ?? CHAIN_ID)
    : CHAIN_ID;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const publicClient = usePublicClient({ chainId: chainId as any });
  const deployment = getDeployment(CHAIN_ID);
  const soothBookAddress = (instanceSoothBook ?? deployment?.SoothBook) as
    | Address
    | undefined;

  const fetchOrderbook = useCallback(
    async (background = false) => {
      if (!marketKey) return;

      if (!background) setIsLoading(true);
      setIsError(false);

      try {
        // Try indexer first (fast, no RPC load)
        const indexerResult = await fetchFromIndexerApi(chainId, marketKey);
        if (indexerResult) {
          setBids(indexerResult.bids);
          setAsks(indexerResult.asks);
          setLastUpdated(Date.now());
          return;
        }

        // Fallback to RPC scan
        if (publicClient && soothBookAddress && marketKey.startsWith('0x')) {
          const mk = marketKey as `0x${string}`;
          const { bids: rpcBids, asks: rpcAsks } = await scanFromRpc(
            publicClient,
            soothBookAddress,
            mk,
          );
          setBids(rpcBids);
          setAsks(rpcAsks);
          setLastUpdated(Date.now());
          return;
        }

        setBids([]);
        setAsks([]);
        setIsError(true);
      } catch {
        setIsError(true);
      } finally {
        if (!background) setIsLoading(false);
      }
    },
    [chainId, marketKey, publicClient, soothBookAddress],
  );

  useEffect(() => {
    fetchOrderbook(false);
  }, [fetchOrderbook]);

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
