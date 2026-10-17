import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { formatUnits } from 'viem';
import { formatShares, formatTokenAmount } from '../factory/factoryTrade/amounts.js';
import type { FactoryTransactionAction } from '../factory/factoryTransactions.js';
import {
  formatSoothMarketReference,
  type SoothHostEvent,
  type SoothMarketReference,
  type SoothTheme,
} from './embed.js';
import { useSoothMarket, useSoothTransactionRecovery, useSoothWallet } from './hooks.js';
import type { SoothRuntime } from './runtime.js';
import type { SoothWalletAdapter } from './wallet.js';
import { describeSoothError } from './errors.js';
import {
  planSoothTrade,
  sendSoothAction,
  type SoothTradeIntent,
  type SoothTradePreview,
} from './trading.js';

export interface SoothMarketProps {
  market: string | SoothMarketReference;
  runtime?: SoothRuntime;
  wallet?: SoothWalletAdapter;
  theme?: SoothTheme;
  appearance?: { accent?: string; radius?: number };
  onEvent?: (event: SoothHostEvent) => void;
  /** Invoked only from the user's connect button when this context has no wallet provider. */
  onWalletUnavailable?: (intent: SoothTradeIntent) => void;
  initialIntent?: SoothTradeIntent;
}
const styles = `
:host{display:block;width:100%;min-width:0;color-scheme:light dark;font:15px/1.5 system-ui,sans-serif}
*,*:before,*:after{box-sizing:border-box}.sooth{--bg:#fff;--fg:#17202d;--muted:#566275;--line:#dce2eb;--sub:#f4f6fa;--yes:#13734b;--no:#b63746;background:var(--bg);color:var(--fg);border:1px solid var(--line);border-radius:var(--sooth-radius,16px);padding:clamp(12px,4%,24px);width:100%;min-width:0;margin:auto;overflow-wrap:anywhere}
.sooth[data-theme=dark]{--bg:#141a25;--fg:#f2f5fc;--muted:#b0bdd0;--line:#364256;--sub:#202a3a;--yes:#70d9a6;--no:#ff9ca8;color-scheme:dark}
@media(prefers-color-scheme:dark){.sooth[data-theme=auto]{--bg:#141a25;--fg:#f2f5fc;--muted:#b0bdd0;--line:#364256;--sub:#202a3a;--yes:#70d9a6;--no:#ff9ca8;color-scheme:dark}}
h2{font-size:clamp(1.3rem,5vw,1.75rem);line-height:1.25;letter-spacing:-.025em;margin:8px 0 16px}h3{font-size:1rem;margin:0 0 8px}p{margin:8px 0}a{color:var(--sooth-accent,#315ed8)}button,input{font:inherit}button{cursor:pointer;background:var(--sooth-accent,#315ed8);color:white;border:1px solid transparent;padding:10px 14px;border-radius:10px;min-height:44px}button:disabled{opacity:.5;cursor:not-allowed}button.secondary{background:var(--sub);color:var(--fg);border-color:var(--line)}:focus-visible{outline:3px solid var(--sooth-accent,#315ed8);outline-offset:3px}input{width:100%;min-width:0;background:var(--bg);color:var(--fg);padding:12px;border:1px solid var(--line);border-radius:10px;min-height:48px}label{display:block;font-weight:600}.row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}.row>*{flex:1;min-width:0}.section{border-top:1px solid var(--line);margin-top:20px;padding-top:20px}.muted,small{color:var(--muted)}.notice{background:var(--sub);padding:14px;border-radius:12px}.error{border-left:4px solid #d34a40}.stack{display:grid;gap:14px}dl{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px 12px;margin:12px 0}dd{margin:0;text-align:right}dt{color:var(--muted)}code{font:12px ui-monospace,monospace}details{margin-top:12px}summary{cursor:pointer;min-height:44px;display:list-item;align-content:center}ul{padding-left:20px}li{margin:10px 0}.wide{width:100%}.eyebrow{font-size:.75rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.market-state{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap}.badge{display:inline-block;border:1px solid var(--line);border-radius:99px;padding:3px 10px;font-size:.8rem;background:var(--sub)}.probability{font-size:2.75rem;font-weight:750;letter-spacing:-.05em;line-height:1.15}.probability small{font-size:1rem;font-weight:500;letter-spacing:0;margin-left:8px}.probability-bar{height:6px;background:var(--line);border-radius:99px;overflow:hidden;margin:12px 0}.probability-bar span{display:block;height:100%;background:var(--yes)}.choices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.choices button{background:var(--sub);color:var(--fg);border-color:var(--line);font-weight:650}.choices button[aria-pressed=true]{border-color:var(--sooth-accent,#315ed8);box-shadow:inset 0 0 0 1px var(--sooth-accent,#315ed8)}.choices .yes{color:var(--yes)}.choices .no{color:var(--no)}.outcomes button{padding:16px 12px;font-size:1.1rem}.amount{position:relative}.amount input{padding-right:82px;font-size:1.25rem}.amount span{position:absolute;right:12px;top:50%;transform:translateY(-50%);font-weight:400;color:var(--muted);pointer-events:none}.result{font-size:1.75rem;line-height:1.25;margin:4px 0}.footer{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-top:20px}.footer small{flex:1}.wallet-note{font-size:.875rem}.positions{display:grid;gap:10px}.positions button{width:100%}@media(prefers-reduced-motion:no-preference){button{transition:background-color .15s,border-color .15s}}
`;
/** Scoped shadow DOM keeps host CSS, routers and provider conventions out of the market UI. */
export function SoothMarket(props: SoothMarketProps) {
  const container = useRef<HTMLDivElement>(null);
  const [root, setRoot] = useState<ShadowRoot | null>(null);
  useEffect(() => {
    if (container.current)
      setRoot(container.current.shadowRoot ?? container.current.attachShadow({ mode: 'open' }));
  }, []);
  const key =
    typeof props.market === 'string' ? props.market : formatSoothMarketReference(props.market);
  return (
    <div ref={container} data-sooth-market="v1">
      {root &&
        createPortal(
          <>
            <style>{styles}</style>
            <MarketExperience key={key} {...props} />
          </>,
          root,
        )}
    </div>
  );
}
function MarketExperience(props: SoothMarketProps) {
  const wallet = useSoothWallet(props.wallet);
  const market = useSoothMarket(props.market, {
    runtime: props.runtime,
    account: wallet.session?.account,
  });
  const recovery = useSoothTransactionRecovery(market.resolved, props.onEvent, market.refresh);
  const [intent, setIntent] = useState<SoothTradeIntent>(
    props.initialIntent ?? { side: 'buy', outcome: 1, shares: '', price: '50' },
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
  const id = useId();
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
  const eventHandler = useRef(props.onEvent);
  eventHandler.current = props.onEvent;
  useEffect(() => {
    if (resolved) eventHandler.current?.({ type: 'market-opened' });
  }, [resolved]);
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
  const submit = async (action: FactoryTransactionAction) => {
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
      props.onEvent?.({
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
  const review = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      if (!resolved || !account) throw new Error('Connect a wallet to review funding and holdings');
      const revision = intentRevision.current;
      const next = await planSoothTrade(resolved, account, intent);
      if (revision === intentRevision.current) setPreview(next);
    });
  };
  const approve = () =>
    void run(async () => {
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
      await submit({
        kind: 'approve',
        venue: resolved.reference.venue,
        amountNative: next.allowance > 0n ? 0n : next.approveNative,
      });
    });
  const trade = () =>
    void run(async () => {
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
      await submit(next.action);
    });
  const appearance = {
    ...(props.appearance?.accent && /^#[0-9a-fA-F]{6}$/.test(props.appearance.accent)
      ? { '--sooth-accent': props.appearance.accent }
      : {}),
    ...(props.appearance?.radius !== undefined && Number.isFinite(props.appearance.radius)
      ? { '--sooth-radius': `${Math.max(0, Math.min(24, props.appearance.radius))}px` }
      : {}),
  } as CSSProperties;
  const held = data?.account?.positions?.positions[0];
  const inventory = data?.account?.inventory;
  const hasSettleablePosition =
    resolved?.reference.venue === 'amm'
      ? Boolean(held && (held.yes > 0n || held.no > 0n))
      : Boolean(
          inventory &&
          (inventory.yesOwned > inventory.yesReserved || inventory.noOwned > inventory.noReserved),
        );
  const yesPriceWad = data?.snapshot.yesPriceWad;
  const yesProbability =
    typeof yesPriceWad === 'bigint' && yesPriceWad >= 0n && yesPriceWad <= 10n ** 18n
      ? Number(formatUnits(yesPriceWad, 18)) * 100
      : null;
  const walletAction = !account ? (
    <button
      type="button"
      className="wide"
      disabled={busy}
      onClick={() => {
        if (!wallet.adapter && props.onWalletUnavailable) props.onWalletUnavailable(intent);
        else
          void run(async () => {
            await wallet.connect();
          });
      }}
    >
      {!wallet.adapter && props.onWalletUnavailable ? 'Open wallet window' : 'Connect wallet'}
    </button>
  ) : !rightChain && resolved ? (
    <button
      type="button"
      className="wide"
      onClick={() => void run(() => wallet.switchChain(resolved.reference.chainId))}
      disabled={busy}
    >
      Switch to chain {resolved.reference.chainId}
    </button>
  ) : null;
  return (
    <section
      className="sooth"
      data-theme={props.theme ?? 'auto'}
      style={appearance}
      aria-label="Sooth prediction market"
      aria-busy={busy || market.loading}
    >
      <header>
        <small className="eyebrow">
          SOOTH ·{' '}
          {resolved?.reference.venue === 'book' ? 'Order book' : resolved ? 'AMM' : 'Market'}
        </small>
        <h2>{resolved?.question ?? 'Loading market…'}</h2>
      </header>
      {market.error && (
        <p role="alert" className="notice error">
          {market.error}{' '}
          <button className="secondary" onClick={market.refresh}>
            Retry market read
          </button>
        </p>
      )}
      {data && resolved && (
        <>
          <div className="market-state">
            <span className="badge">
              {data.snapshot.settled
                ? 'Resolved'
                : tradingOpen
                  ? 'Open for trading'
                  : data.snapshot.isResolving
                    ? 'Resolving'
                    : 'Trading closed'}
            </span>
            <small>Closes {new Date(Number(data.snapshot.deadline) * 1000).toLocaleString()}</small>
          </div>
          {data.snapshot.settled ? (
            <div className="notice section" aria-label="Market result">
              <p className="eyebrow">Final result</p>
              <h3 className="result">
                Resolved:{' '}
                {data.snapshot.outcome === 1
                  ? 'YES'
                  : data.snapshot.outcome === 0
                    ? 'NO'
                    : 'INVALID'}
              </h3>
              <p className="muted">
                {data.snapshot.outcome === 2
                  ? 'The final result is INVALID. Available claims are shown with your positions.'
                  : 'Trading has ended. Available claims are shown with your positions.'}
              </p>
            </div>
          ) : (
            <div className="section" aria-label="Market probability">
              <p className="muted">
                {tradingOpen && !market.error
                  ? 'Live AMM probability'
                  : 'Last read AMM probability'}
              </p>
              {yesProbability !== null ? (
                <>
                  <div className="probability">
                    {yesProbability.toLocaleString(undefined, { maximumFractionDigits: 1 })}%
                    <small>YES</small>
                  </div>
                  <div className="probability-bar" aria-hidden="true">
                    <span style={{ width: `${yesProbability}%` }} />
                  </div>
                </>
              ) : (
                <p>Probability unavailable</p>
              )}
              {resolved.reference.venue === 'book' && (
                <small>
                  AMM reference probability. Your limit price sets the order book price.
                </small>
              )}
              {!tradingOpen && (
                <p className="notice">
                  {data.snapshot.isResolving
                    ? 'Resolution is in progress. Trading is closed.'
                    : 'Trading is closed. Awaiting the final result.'}
                </p>
              )}
            </div>
          )}
          <details>
            <summary>Resolution rules</summary>
            <p style={{ whiteSpace: 'pre-wrap' }}>{resolved.rules}</p>
          </details>
          {tradingOpen ? (
            <form className="section stack" onSubmit={review} aria-label="Trade shares">
              <div className="choices" role="group" aria-label="Action">
                <button
                  type="button"
                  aria-pressed={intent.side === 'buy'}
                  onClick={() => updateIntent({ ...intent, side: 'buy' })}
                >
                  Buy
                </button>
                <button
                  type="button"
                  aria-pressed={intent.side === 'sell'}
                  onClick={() => updateIntent({ ...intent, side: 'sell' })}
                >
                  Sell
                </button>
              </div>
              <div className="choices outcomes" role="group" aria-label="Outcome">
                <button
                  type="button"
                  className="yes"
                  aria-pressed={intent.outcome === 1}
                  onClick={() => updateIntent({ ...intent, outcome: 1 })}
                >
                  YES
                </button>
                <button
                  type="button"
                  className="no"
                  aria-pressed={intent.outcome === 0}
                  onClick={() => updateIntent({ ...intent, outcome: 0 })}
                >
                  NO
                </button>
              </div>
              <div>
                <label htmlFor={`${id}-shares`}>Shares</label>
                <div className="amount">
                  <input
                    id={`${id}-shares`}
                    inputMode="decimal"
                    autoComplete="off"
                    value={intent.shares}
                    onChange={(event) => updateIntent({ ...intent, shares: event.target.value })}
                    placeholder="0.00"
                    aria-describedby={`${id}-units`}
                  />
                  <span aria-hidden="true">{intent.outcome === 1 ? 'YES' : 'NO'}</span>
                </div>
                <small id={`${id}-units`}>
                  Amount in shares. Payment and proceeds use {data.token.symbol}.
                </small>
              </div>
              {resolved.reference.venue === 'book' && (
                <label htmlFor={`${id}-price`}>
                  Limit price (cents)
                  <input
                    id={`${id}-price`}
                    inputMode="decimal"
                    value={intent.price}
                    onChange={(event) => updateIntent({ ...intent, price: event.target.value })}
                  />
                </label>
              )}
              {data.account && (
                <small>Available: {formatTokenAmount(data.account.balance, data.token)}</small>
              )}
              <small>
                {resolved.reference.venue === 'book'
                  ? 'Unfilled shares stay open until filled, cancelled or expired. An order confirmation does not confirm a purchase.'
                  : 'Review includes fees and a 1% slippage bound.'}
              </small>
              {walletAction ??
                (!preview && (
                  <button type="submit" disabled={!ready}>
                    {hasPending
                      ? 'Transaction pending'
                      : busy
                        ? 'Preparing review…'
                        : `Review ${intent.side}`}
                  </button>
                ))}
            </form>
          ) : (
            walletAction && (
              <div className="section stack">
                <p className="muted">
                  {account
                    ? 'Switch networks to manage your positions.'
                    : 'Connect your wallet to see positions and available claims.'}
                </p>
                {walletAction}
              </div>
            )
          )}
          {preview && tradingOpen && (
            <section className="section notice" aria-label="Trade review">
              <h3>
                Review {intent.side} {intent.outcome === 1 ? 'YES' : 'NO'}
              </h3>
              <p>{preview.description}</p>
              <dl>
                <dt>Venue fee</dt>
                <dd>{preview.feeBps / 100}%</dd>
                <dt>Maximum token input</dt>
                <dd>{formatTokenAmount(preview.requiredNative, data.token)}</dd>
                {preview.boundWad !== undefined && (
                  <>
                    <dt>{intent.side === 'buy' ? 'Maximum spend' : 'Minimum proceeds'}</dt>
                    <dd>
                      {formatUnits(preview.boundWad, 18)} {data.token.symbol}
                    </dd>
                  </>
                )}
              </dl>
              {preview.approveNative !== null ? (
                <>
                  <p>
                    Authorize only {formatTokenAmount(preview.approveNative, data.token)} for the
                    verified {resolved.reference.venue} spender. Trading requires a separate
                    confirmation.
                  </p>
                  <details>
                    <summary>Approval recipient</summary>
                    <code>
                      {resolved.reference.venue === 'amm'
                        ? resolved.context.contracts.amm
                        : resolved.context.contracts.book}
                    </code>
                  </details>
                  {preview.allowance > 0n && (
                    <p>
                      The existing allowance must first be reset to zero. Review again after
                      confirmation.
                    </p>
                  )}
                  <button className="wide" onClick={approve} disabled={!ready}>
                    {preview.allowance > 0n ? 'Reset allowance to zero' : 'Approve exact amount'}
                  </button>
                </>
              ) : (
                <button className="wide" onClick={trade} disabled={!ready}>
                  Confirm {intent.side}
                </button>
              )}
            </section>
          )}
          {data.account && (
            <section className="section positions">
              <h3>Your positions</h3>
              <dl>
                <dt>YES held</dt>
                <dd>{formatShares(held?.yes ?? inventory?.yesOwned ?? 0n)}</dd>
                <dt>NO held</dt>
                <dd>{formatShares(held?.no ?? inventory?.noOwned ?? 0n)}</dd>
                {inventory && (
                  <>
                    <dt>YES reserved</dt>
                    <dd>{formatShares(inventory.yesReserved)}</dd>
                    <dt>NO reserved</dt>
                    <dd>{formatShares(inventory.noReserved)}</dd>
                    <dt>Collateral reserved</dt>
                    <dd>{formatTokenAmount(inventory.cashReserved, data.token)}</dd>
                  </>
                )}
              </dl>
              {data.account.ordersError && (
                <p role="alert" className="notice error">
                  Open-order discovery is incomplete: {data.account.ordersError}. Holdings above are
                  current; this is not an empty order list.{' '}
                  <button className="secondary" onClick={market.refresh}>
                    Retry orders
                  </button>
                </p>
              )}
              {data.account.orders && (
                <>
                  <h3>Open orders</h3>
                  {data.account.orders.orders.length ? (
                    <ul>
                      {data.account.orders.orders.map((order) => (
                        <li key={String(order.orderId)}>
                          {order.action === 0 ? 'Buy' : 'Sell'} {formatShares(order.amount)}{' '}
                          {order.outcome === 1 ? 'YES' : 'NO'} · remaining order #
                          {String(order.orderId)}{' '}
                          <button
                            className="secondary"
                            disabled={!ready}
                            onClick={() =>
                              void run(() =>
                                submit({ kind: 'cancelOrder', orderId: order.orderId }),
                              )
                            }
                          >
                            Cancel
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>No open orders.</p>
                  )}
                </>
              )}
              {data.snapshot.settled && hasSettleablePosition && (
                <button
                  disabled={!ready}
                  onClick={() =>
                    void run(() =>
                      submit({ kind: 'settlePosition', venue: resolved.reference.venue }),
                    )
                  }
                >
                  Claim settled {resolved.reference.venue} position
                </button>
              )}
              {resolved.reference.venue === 'amm' &&
                data.account.entitlements.floorWad !== null &&
                data.account.entitlements.floorWad > 0n && (
                  <button
                    disabled={!ready}
                    onClick={() => void run(() => submit({ kind: 'claimFloor' }))}
                  >
                    Claim floor entitlement
                  </button>
                )}
              {resolved.reference.venue === 'book' &&
                (data.snapshot.settled
                  ? data.snapshot.settlementKind === 2
                  : data.snapshot.blockTimestamp !== null &&
                    data.snapshot.blockTimestamp >= data.snapshot.permissionlessInvalidationAt) &&
                data.account.entitlements.bookTimeoutRefundNative !== null &&
                data.account.entitlements.bookTimeoutRefundNative > 0n && (
                  <button
                    disabled={!ready}
                    onClick={() => void run(() => submit({ kind: 'claimTimeoutRefund' }))}
                  >
                    Claim timeout refund
                  </button>
                )}
              {resolved.reference.venue === 'book' &&
                data.account.entitlements.bookDeferredNative !== null &&
                data.account.entitlements.bookDeferredNative > 0n && (
                  <button
                    disabled={!ready}
                    onClick={() => void run(() => submit({ kind: 'claimDeferred' }))}
                  >
                    Claim deferred collateral
                  </button>
                )}
            </section>
          )}
          <details className="section">
            <summary>Market and wallet details</summary>
            <dl>
              <dt>Network</dt>
              <dd>Chain {resolved.reference.chainId}</dd>
              <dt>Venue</dt>
              <dd>{resolved.reference.venue === 'amm' ? 'AMM' : 'Order book'}</dd>
              <dt>Collateral</dt>
              <dd>
                {data.token.symbol} ({data.token.decimals} decimals)
              </dd>
              {account && (
                <>
                  <dt>Wallet</dt>
                  <dd>
                    <code>{account}</code>
                  </dd>
                </>
              )}
              {data.account && (
                <>
                  <dt>Current allowance</dt>
                  <dd>{formatTokenAmount(data.account.allowance, data.token)}</dd>
                </>
              )}
            </dl>
            <p>
              Collateral contract: <code>{data.token.address}</code>
            </p>
            <p>
              Market identity: <code>{formatSoothMarketReference(resolved.reference)}</code>
            </p>
            <p className="muted">
              Allowance is the on-chain amount, including any cap edited in your wallet. Holdings
              and approvals belong to this venue; there is no automatic routing between AMM and
              book.
            </p>
            <p className="muted">
              New purchases require a listed market and current registry policy. Sells,
              cancellations and claims remain available when policy blocks new purchases.
            </p>
            <a href={resolved.canonicalUrl} target="_blank" rel="noopener noreferrer">
              Open this market in Sooth
            </a>
          </details>
        </>
      )}
      {(error || wallet.error || recovery.error) && (
        <p role="alert" className="notice error">
          {error || wallet.error || recovery.error}
        </p>
      )}
      <section
        className={
          recovery.result || recovery.pending.length || storageWarning ? 'section' : undefined
        }
        aria-live="polite"
        aria-label="Transaction status"
      >
        {recovery.result && <p role="status">{recovery.result}</p>}
        {recovery.pending.map((item) => (
          <div className="notice" key={item.hash}>
            <p>Pending {item.label}</p>
            <small>Confirmation is checked automatically. Reopening does not resubmit.</small>
            <details open={storageWarning}>
              <summary>Transaction details</summary>
              <p>
                Wallet: <code>{item.account}</code>
              </p>
              <p>
                Transaction: <code>{item.hash}</code>
              </p>
            </details>
          </div>
        ))}
        {storageWarning && (
          <p className="notice error">
            This browser blocked durable storage. Copy the transaction hash above before closing
            this window; keep it open until its receipt is confirmed.
          </p>
        )}
      </section>
      {recovery.events.length > 0 && (
        <details>
          <summary>Confirmed on-chain events</summary>
          <p className="muted">
            Decoded from this receipt's verified contracts. Numeric values below use raw contract
            units; current holdings and remaining orders are shown above.
          </p>
          <ul>
            {recovery.events.map((event) => (
              <li key={`${event.address}:${event.logIndex}`}>
                <strong>{event.eventName}</strong>
                <pre style={{ overflowX: 'auto', fontSize: 12 }}>
                  {JSON.stringify(
                    event.args,
                    (_key, value: unknown) =>
                      typeof value === 'bigint' ? value.toString() : value,
                    2,
                  )}
                </pre>
              </li>
            ))}
          </ul>
        </details>
      )}
      {market.updatedAt && (
        <div className="footer">
          <small>Updated {new Date(market.updatedAt).toLocaleTimeString()}</small>
          <button className="secondary" onClick={market.refresh} disabled={busy}>
            Refresh
          </button>
        </div>
      )}
    </section>
  );
}
