import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Address } from 'viem';
import {
  readSoothMarket,
  type SoothMarketData,
  type SoothResolvedMarket,
  type SoothRuntime,
} from './runtime.js';
import {
  formatSoothMarketReference,
  parseSoothMarketReference,
  type SoothHostEvent,
  type SoothMarketReference,
} from './embed.js';
import {
  getInjectedSoothWallet,
  loadSoothPending,
  reconcileSoothPending,
  removeSoothPending,
  type SoothPendingTransaction,
  type SoothWalletAdapter,
} from './wallet.js';
import { noteReceipt } from '../factory/factoryTrade/afterReceipt.js';
import { decodeFactoryReceiptEvents, type FactoryReceiptEvent } from '../factory/factoryReceipt.js';
import { describeSoothError } from './errors.js';

interface SoothProviderValue {
  runtime?: SoothRuntime;
  wallet?: SoothWalletAdapter;
}
const SoothContext = createContext<SoothProviderValue>({});
export function SoothProvider({
  runtime,
  wallet,
  children,
}: SoothProviderValue & { children: ReactNode }) {
  return <SoothContext.Provider value={{ runtime, wallet }}>{children}</SoothContext.Provider>;
}
/** Shared provider fallback for node and market entry points. */
export function useSoothRuntime(supplied?: SoothRuntime): SoothRuntime | undefined {
  const provider = useContext(SoothContext);
  return supplied ?? provider.runtime;
}
export function useSoothWallet(supplied?: SoothWalletAdapter) {
  const provider = useContext(SoothContext);
  const [injected, setInjected] = useState<SoothWalletAdapter | null>(null);
  const adapter = supplied ?? provider.wallet ?? injected;
  const [session, setSession] = useState<{ account: Address; chainId: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setInjected(getInjectedSoothWallet());
  }, []);
  useEffect(() => {
    let active = true;
    setSession(null);
    const refresh = () => {
      void adapter
        ?.getSession()
        .then((value) => {
          if (active) setSession(value);
        })
        .catch((reason) => {
          if (active) {
            setSession(null);
            setError(describeSoothError(reason));
          }
        });
    };
    refresh();
    const unsubscribe = adapter?.subscribe?.(refresh);
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [adapter]);
  const connect = useCallback(async () => {
    if (!adapter)
      throw new Error(
        'No wallet is available in this browser context. Open this market in its wallet window.',
      );
    try {
      const value = await adapter.connect();
      setSession(value);
      setError(null);
      return value;
    } catch (reason) {
      setError(describeSoothError(reason));
      throw reason;
    }
  }, [adapter]);
  const switchChain = useCallback(
    async (chainId: number) => {
      if (!adapter) throw new Error('Connect a wallet first');
      await adapter.switchChain(chainId);
      setSession(await adapter.getSession());
    },
    [adapter],
  );
  return { adapter, session, error, connect, switchChain };
}
export function useSoothMarket(
  market: string | SoothMarketReference,
  options: { runtime?: SoothRuntime; account?: Address; refreshInterval?: number } = {},
) {
  const provider = useContext(SoothContext);
  const runtime = options.runtime ?? provider.runtime;
  const key = typeof market === 'string' ? market : formatSoothMarketReference(market);
  const [resolved, setResolved] = useState<SoothResolvedMarket | null>(null);
  const [data, setData] = useState<SoothMarketData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const generation = useRef(0);
  const selection = useRef({ key, runtime });
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    const current = ++generation.current;
    if (selection.current.key !== key || selection.current.runtime !== runtime) {
      selection.current = { key, runtime };
      setResolved(null);
    }
    setData(null);
    setUpdatedAt(null);
    setLoading(true);
    setError(null);
    if (!runtime) {
      setError('Supply a trusted Sooth runtime through SoothProvider or the runtime prop.');
      setLoading(false);
      return;
    }
    let inFlight = false;
    let binding: SoothResolvedMarket | null = null;
    const load = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        binding ??= await runtime.resolve(parseSoothMarketReference(key));
        if (generation.current === current) setResolved(binding);
        const next = await readSoothMarket(binding, options.account);
        if (generation.current !== current) return;
        setResolved(binding);
        setData(next);
        setError(null);
        setUpdatedAt(Date.now());
      } catch (reason) {
        if (generation.current === current) setError(describeSoothError(reason));
      } finally {
        inFlight = false;
        if (generation.current === current) setLoading(false);
      }
    };
    void load();
    const timer = setInterval(() => {
      void load();
    }, options.refreshInterval ?? 15_000);
    return () => {
      generation.current++;
      clearInterval(timer);
    };
  }, [key, runtime, options.account, options.refreshInterval, revision]);
  return { resolved, data, error, loading, updatedAt, refresh };
}
export function useSoothTransactionRecovery(
  resolved: SoothResolvedMarket | null,
  onEvent?: (event: SoothHostEvent) => void,
  onConfirmed?: () => void,
) {
  const [pending, setPending] = useState<SoothPendingTransaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [events, setEvents] = useState<FactoryReceiptEvent[]>([]);
  const handlers = useRef({ onEvent, onConfirmed });
  handlers.current = { onEvent, onConfirmed };
  const market = resolved ? formatSoothMarketReference(resolved.reference) : null;
  const addPending = useCallback((record: SoothPendingTransaction) => {
    setPending((previous) => [...previous.filter((item) => item.hash !== record.hash), record]);
    setResult(`${record.label} submitted. Waiting for its receipt; do not submit again.`);
  }, []);
  useEffect(() => {
    setPending(market ? loadSoothPending(market) : []);
    setError(null);
    setResult(null);
    setEvents([]);
  }, [market]);
  useEffect(() => {
    if (!resolved || !market) return;
    const sync = () =>
      setPending((previous) => {
        const stored = loadSoothPending(market);
        return [
          ...previous,
          ...stored.filter((item) => !previous.some((old) => old.hash === item.hash)),
        ];
      });
    window.addEventListener('storage', sync);
    window.addEventListener('focus', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', sync);
    };
  }, [resolved, market]);
  useEffect(() => {
    if (!resolved || pending.length === 0) return;
    let cancelled = false;
    let running = false;
    const reconcile = async () => {
      if (running) return;
      running = true;
      for (const record of pending) {
        try {
          const state = await reconcileSoothPending(resolved.client, record);
          if (cancelled || state.status === 'pending') continue;
          removeSoothPending(record.market, record.hash);
          if (state.status === 'confirmed') {
            noteReceipt(resolved.context, state.receipt.blockNumber);
            setEvents(
              decodeFactoryReceiptEvents({
                context: resolved.context,
                receipt: state.receipt,
                market: resolved.reference.market,
              }),
            );
          }
          setPending((previous) => previous.filter((item) => item.hash !== record.hash));
          setResult(
            state.status === 'confirmed'
              ? `${record.label} confirmed. Balances and open orders are being refreshed.`
              : `${record.label} reverted on chain. No automatic retry was made.`,
          );
          setError(null);
          handlers.current.onConfirmed?.();
          try {
            handlers.current.onEvent?.({
              type: state.status === 'confirmed' ? 'transaction-confirmed' : 'transaction-failed',
              hash: record.hash,
              chainId: record.chainId,
            });
          } catch {
            /* Host observers cannot change a confirmed transaction's status. */
          }
        } catch (reason) {
          if (!cancelled)
            setError(
              `Receipt recovery is unavailable: ${describeSoothError(reason)}. The transaction remains pending.`,
            );
        }
      }
      running = false;
    };
    void reconcile();
    const timer = setInterval(() => {
      void reconcile();
    }, 4_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [resolved, pending]);
  return { pending, error, result, events, addPending };
}
