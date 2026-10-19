import { useEffect, useRef, useState } from 'react';
import type { Address } from 'viem';
import type { FactoryTransactionAction } from '../factory/factoryTransactions.js';
import type { SoothHostEvent } from './embed.js';
import { describeSoothError } from './errors.js';
import {
  useSoothTransactionRecovery,
  type SoothMarketState,
  type SoothTransactionRecoveryState,
  type SoothWalletState,
} from './hooks.js';
import {
  planSoothTrade,
  sendSoothAction,
  type SoothTradeIntent,
  type SoothTradePreview,
} from './trading.js';
import type { SoothWalletAdapter } from './wallet.js';

export interface SoothMarketActionsOptions {
  market: SoothMarketState;
  wallet: SoothWalletState;
  initialIntent?: SoothTradeIntent;
  onEvent?: (event: SoothHostEvent) => void;
  /** Invoked only from `connect()` when this context has no wallet provider. */
  onWalletUnavailable?: (intent: SoothTradeIntent) => void;
}

export type SoothClaimKind = 'claimFloor' | 'claimTimeoutRefund' | 'claimDeferred';

export interface SoothMarketActions {
  recovery: SoothTransactionRecoveryState;
  intent: SoothTradeIntent;
  /** Replaces the intent and invalidates any review in progress. */
  setIntent: (next: SoothTradeIntent) => void;
  preview: SoothTradePreview | null;
  error: string | null;
  busy: boolean;
  storageWarning: boolean;
  account: Address | undefined;
  rightChain: boolean;
  hasPending: boolean;
  /** Connected on the right chain, market read, nothing pending and nothing in flight. */
  ready: boolean;
  tradingOpen: boolean;
  /** `connect()` hands off to `onWalletUnavailable` instead of connecting. */
  walletUnavailable: boolean;
  review: () => Promise<void>;
  approve: () => Promise<void>;
  submit: () => Promise<void>;
  clearReview: () => void;
  /** Sign exactly one explicit action (cancel, claim, settle, LP) under the same guards. */
  execute: (action: FactoryTransactionAction) => Promise<void>;
  cancelOrder: (orderId: bigint) => Promise<void>;
  claim: (kind: SoothClaimKind) => Promise<void>;
  settle: (venue: 'amm' | 'book') => Promise<void>;
  connect: () => Promise<void>;
  switchChain: () => Promise<void>;
}

/**
 * Transaction safety glue for one market view: fresh re-planning before every signature,
 * revision and unmount guards, pending-record recovery and single-flight busy/error state.
 */
export function useSoothMarketActions(options: SoothMarketActionsOptions): SoothMarketActions {
  const { market, wallet } = options;
  const recovery = useSoothTransactionRecovery(market.resolved, options.onEvent, market.refresh);
  const [intent, setIntent] = useState<SoothTradeIntent>(
    options.initialIntent ?? { side: 'buy', outcome: 1, shares: '', price: '50' },
  );
  const [preview, setPreview] = useState<SoothTradePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const inFlight = useRef(false);
  const intentRevision = useRef(0);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      intentRevision.current++;
    };
  }, []);
  const { resolved, data } = market;
  const account = wallet.session?.account;
  const rightChain = wallet.session?.chainId === resolved?.reference.chainId;
  const hasPending = recovery.pending.some(
    (item) => item.account.toLowerCase() === account?.toLowerCase(),
  );
  const ready = Boolean(
    resolved && data && account && rightChain && !hasPending && !busy && !market.error,
  );
  const tradingOpen = Boolean(data?.snapshot.tradingOpen && !data.snapshot.settled);
  useEffect(() => {
    intentRevision.current++;
    setPreview(null);
  }, [tradingOpen]);
  const reviewedWallet = useRef({ account, chainId: wallet.session?.chainId });
  useEffect(() => {
    const previous = reviewedWallet.current;
    reviewedWallet.current = { account, chainId: wallet.session?.chainId };
    intentRevision.current++;
    setPreview(null);
    if (
      previous.account &&
      (previous.account !== account || previous.chainId !== wallet.session?.chainId)
    ) {
      setError('Wallet identity changed. Review the trade again before signing.');
    }
  }, [account, wallet.session?.chainId]);
  const updateIntent = (next: SoothTradeIntent) => {
    intentRevision.current++;
    setIntent(next);
    setPreview(null);
    setError(null);
  };
  const clearReview = () => {
    intentRevision.current++;
    setPreview(null);
  };
  const run = async (operation: () => Promise<void>) => {
    if (!mounted.current || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await operation();
    } catch (reason) {
      if (mounted.current) setError(describeSoothError(reason));
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const send = async (action: FactoryTransactionAction) => {
    if (!resolved || !account || !wallet.adapter || !rightChain)
      throw new Error('Connect the expected account and network before signing');
    if (hasPending) throw new Error('Wait for the pending transaction to be reconciled');
    const revision = intentRevision.current;
    const adapter = wallet.adapter;
    const guardedWallet: SoothWalletAdapter = {
      connect: () => adapter.connect(),
      getSession: () => adapter.getSession(),
      switchChain: (chainId) => adapter.switchChain(chainId),
      sendTransaction: (request) => {
        if (!mounted.current || revision !== intentRevision.current)
          throw new Error(
            'The market view or transaction intent changed. Review again before signing.',
          );
        return adapter.sendTransaction(request);
      },
    };
    const pending = await sendSoothAction(resolved, guardedWallet, account, action, (record) => {
      recovery.addPending(record);
      options.onEvent?.({
        type: 'transaction-submitted',
        hash: record.hash,
        chainId: record.chainId,
      });
    });
    if (mounted.current) {
      setStorageWarning(!pending.storageAvailable);
      setPreview(null);
    }
  };
  /** Plan the current intent; the preview is dropped if the intent changed meanwhile. */
  const review = () =>
    run(async () => {
      if (!resolved || !account) throw new Error('Connect a wallet to review funding and holdings');
      const revision = intentRevision.current;
      const next = await planSoothTrade(resolved, account, intent);
      if (revision === intentRevision.current) setPreview(next);
    });
  /** Re-plan and sign only the reviewed exact approval (or zero reset). */
  const approve = () =>
    run(async () => {
      if (!resolved || !account || !preview || preview.approveNative === null) return;
      const revision = intentRevision.current;
      const next = await planSoothTrade(resolved, account, intent);
      if (revision !== intentRevision.current)
        throw new Error('Trade inputs changed. Review the authorization again.');
      if (next.approveNative === null) {
        setPreview(next);
        return;
      }
      if (
        next.approveNative !== preview.approveNative ||
        next.allowance > 0n !== preview.allowance > 0n
      ) {
        setPreview(next);
        throw new Error(
          'The approval amount or reset step changed. Review the updated authorization and confirm again.',
        );
      }
      await send({
        kind: 'approve',
        venue: resolved.reference.venue,
        amountNative: next.allowance > 0n ? 0n : next.approveNative,
      });
    });
  /** Re-plan and sign the reviewed trade only if its bounds are unchanged. */
  const submit = () =>
    run(async () => {
      if (!resolved || !account || !preview) return;
      const revision = intentRevision.current;
      const next = await planSoothTrade(resolved, account, intent);
      if (revision !== intentRevision.current)
        throw new Error('Trade inputs changed. Review the trade again before signing.');
      if (next.approveNative !== null) {
        setPreview(next);
        throw new Error('Approval changed. Review the refreshed authorization before trading.');
      }
      if (
        next.requiredNative !== preview.requiredNative ||
        next.boundWad !== preview.boundWad ||
        next.description !== preview.description
      ) {
        setPreview(next);
        throw new Error('The quote changed. Review the updated bounds and confirm again.');
      }
      await send(next.action);
    });
  const execute = (action: FactoryTransactionAction) => run(() => send(action));
  const walletUnavailable = !wallet.adapter && Boolean(options.onWalletUnavailable);
  const connect = async () => {
    if (!wallet.adapter && options.onWalletUnavailable) options.onWalletUnavailable(intent);
    else
      await run(async () => {
        await wallet.connect();
      });
  };
  const switchChain = () =>
    run(async () => {
      if (resolved) await wallet.switchChain(resolved.reference.chainId);
    });
  return {
    recovery,
    intent,
    setIntent: updateIntent,
    preview,
    error,
    busy,
    storageWarning,
    account,
    rightChain,
    hasPending,
    ready,
    tradingOpen,
    walletUnavailable,
    review,
    approve,
    submit,
    clearReview,
    execute,
    cancelOrder: (orderId: bigint) => execute({ kind: 'cancelOrder', orderId }),
    claim: (kind: SoothClaimKind) => execute({ kind }),
    settle: (venue: 'amm' | 'book') => execute({ kind: 'settlePosition', venue }),
    connect,
    switchChain,
  };
}
