import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSoothDepth, useSoothLiquidity, useSoothMarketSummary } from './dataHooks.js';
import {
  formatSoothMarketReference,
  type SoothHostEvent,
  type SoothMarketReference,
  type SoothTheme,
} from './embed.js';
import { useSoothMarket, useSoothWallet } from './hooks.js';
import { AccountPanel } from './market/AccountPanel.js';
import { MarketCharts } from './market/MarketCharts.js';
import { MarketDetails, MarketStats } from './market/MarketDetails.js';
import { MarketHeader } from './market/MarketHeader.js';
import { TradePanel } from './market/TradePanel.js';
import { TransactionStatus } from './market/TransactionStatus.js';
import type { SoothRuntime } from './runtime.js';
import type { SoothTradeIntent } from './trading.js';
import { useSoothMarketActions } from './tradeFlow.js';
import { soothText, type SoothLocale } from './ui/i18n.js';
import { Disclosure, Notice, Skeleton } from './ui/primitives.js';
import { soothBaseCss, soothRootStyle } from './ui/theme.js';
import type { SoothWalletAdapter } from './wallet.js';

export interface SoothMarketProps {
  market: string | SoothMarketReference;
  runtime?: SoothRuntime;
  wallet?: SoothWalletAdapter;
  theme?: SoothTheme;
  appearance?: { accent?: string; radius?: number };
  locale?: SoothLocale;
  onEvent?: (event: SoothHostEvent) => void;
  /** Invoked only from the user's connect button when this context has no wallet provider. */
  onWalletUnavailable?: (intent: SoothTradeIntent) => void;
  initialIntent?: SoothTradeIntent;
}

/*
 * Narrow containers stack header → trade → charts/account/details so the ticket sits right
 * under the prices inside a 480-560px iframe; from 860px the trade column moves right.
 */
const marketCss = `
.s-market-layout { grid-template-areas: "head" "side" "main"; gap: 8px; }
.s-market-layout > .s-market-head { grid-area: head; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.s-market-layout > .s-layout-side { grid-area: side; }
.s-market-layout > .s-layout-main { grid-area: main; }
@container sooth (min-width: 860px) {
  .s-market-layout { grid-template-areas: "head side" "main side"; grid-template-rows: auto 1fr; }
}
.s-wrap { flex-wrap: wrap; }
.s-push { margin-left: auto; }
.s-pre { white-space: pre-wrap; }
.s-pre-code { overflow-x: auto; font: 11px/1.4 var(--s-mono); margin: 4px 0 0; }
.s-copy { gap: 4px; }
.s-copy code, .s-select-all { font: 12px var(--s-mono); user-select: all; overflow-wrap: anywhere; }
.s-price-card-static { cursor: default; }
.s-quote { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border-radius: var(--s-radius-sm); background: var(--s-surface-2); }
.s-quote [data-impact=warn] > :last-child, .s-quote [data-impact=high] > :last-child { font-weight: 700; }
.s-market-layout > .s-market-head > .s-card, .s-trade-ticket, .s-market-layout > .s-layout-main > .s-card:first-child { padding: 12px; }
.s-trade-ticket .s-field-heading { display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 4px 12px; }
.s-trade-ticket .s-balance { font-size: 12px; color: var(--s-muted); }
.s-trade-ticket .s-quote-total { font-weight: 700; }
.s-trade-ticket .s-quote .s-disclosure { margin-top: 2px; }
.s-market-layout > .s-layout-main, .s-market-layout > .s-layout-side { gap: 12px; }
.s-tabs { overflow-x: auto; }
.s-market-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; padding: 12px 16px; }
.s-market-foot .s-btn { flex: 0 0 auto; color: var(--s-muted); font-size: 12px; font-weight: 400; }
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
            <style>{soothBaseCss + marketCss}</style>
            <MarketExperience key={key} {...props} />
          </>,
          root,
        )}
    </div>
  );
}

function MarketExperience(props: SoothMarketProps) {
  const strings = soothText(props.locale ?? 'en');
  const { t } = strings;
  const wallet = useSoothWallet(props.wallet);
  const market = useSoothMarket(props.market, {
    runtime: props.runtime,
    account: wallet.session?.account,
  });
  const actions = useSoothMarketActions({
    market,
    wallet,
    initialIntent: props.initialIntent,
    onEvent: props.onEvent,
    onWalletUnavailable: props.onWalletUnavailable,
  });
  const { recovery, account, rightChain, busy, tradingOpen } = actions;
  const { resolved, data } = market;
  const book = resolved?.reference.venue === 'book';
  const depth = useSoothDepth(resolved, { enabled: book });
  const summary = useSoothMarketSummary(book ? null : resolved);
  const liquidity = useSoothLiquidity(resolved, account);
  const refreshing = market.loading || liquidity.loading;
  const eventHandler = useRef(props.onEvent);
  eventHandler.current = props.onEvent;
  useEffect(() => {
    if (resolved) eventHandler.current?.({ type: 'market-opened' });
  }, [resolved]);
  // LP receipts are not polled; refresh after local transactions or observed settlement.
  const refreshLiquidity = liquidity.refresh;
  const settled = data?.snapshot.settled;
  useEffect(() => {
    if (recovery.result || settled) refreshLiquidity();
  }, [recovery.result, settled, refreshLiquidity]);

  const walletAction = !account ? (
    <button
      type="button"
      className="s-btn s-btn-primary s-btn-block"
      disabled={busy}
      onClick={() => void actions.connect()}
    >
      {actions.walletUnavailable ? t('wallet.openWindow') : t('wallet.connect')}
    </button>
  ) : !rightChain && resolved ? (
    <button
      type="button"
      className="s-btn s-btn-primary s-btn-block"
      onClick={() => void actions.switchChain()}
      disabled={busy}
    >
      {t('wallet.switchNetwork')}
    </button>
  ) : null;
  const status = (
    <TransactionStatus
      strings={strings}
      recovery={recovery}
      error={actions.error || wallet.error || recovery.error}
      storageWarning={actions.storageWarning}
    />
  );
  const accountPanel = data && resolved && (
    <AccountPanel
      strings={strings}
      resolved={resolved}
      data={data}
      actions={actions}
      liquidity={liquidity}
      refresh={market.refresh}
    />
  );
  return (
    <section
      className="sooth-root"
      data-theme={props.theme ?? 'auto'}
      style={soothRootStyle(props.appearance)}
      aria-label={t('market.defaultLabel')}
      aria-busy={busy || market.loading}
    >
      <div className="s-page">
        {market.error && (
          <Notice
            tone="error"
            action={
              <button
                type="button"
                className="s-btn s-btn-secondary s-btn-sm"
                onClick={market.refresh}
              >
                {t('market.retryRead')}
              </button>
            }
          >
            <p>{t(data ? 'market.refreshFailed' : 'market.loadFailed')}</p>
            <Disclosure summary={t('market.errorDetails')}>
              <pre className="s-pre s-pre-code">{market.error}</pre>
            </Disclosure>
          </Notice>
        )}
        {data && resolved ? (
          <div className="s-layout s-market-layout">
            <div className="s-market-head">
              <MarketHeader
                strings={strings}
                resolved={resolved}
                data={data}
                tradingOpen={tradingOpen}
                live={tradingOpen && !market.error}
              />
            </div>
            <div className="s-layout-side">
              {tradingOpen ? (
                <TradePanel
                  strings={strings}
                  resolved={resolved}
                  data={data}
                  actions={actions}
                  walletAction={walletAction}
                  marketReadFailed={Boolean(market.error)}
                />
              ) : walletAction ? (
                <section className="s-card" aria-label={t('account.title')}>
                  <p className="s-muted">
                    {account ? t('wallet.wrongNetwork') : t('wallet.connectForPositions')}
                  </p>
                  {walletAction}
                </section>
              ) : (
                accountPanel
              )}
              {status}
            </div>
            <div className="s-layout-main">
              <MarketCharts strings={strings} resolved={resolved} depth={book ? depth : null} />
              <MarketStats
                strings={strings}
                resolved={resolved}
                data={data}
                summary={summary}
                depth={book ? depth : null}
              />
              {tradingOpen && accountPanel}
              <MarketDetails strings={strings} resolved={resolved} data={data} account={account} />
              {market.updatedAt && (
                <div className="s-market-foot">
                  <span className="s-small s-muted">
                    {t('market.updated', { time: new Date(market.updatedAt).toLocaleTimeString() })}
                  </span>
                  <button
                    type="button"
                    className="s-btn s-btn-ghost s-btn-sm"
                    onClick={() => {
                      market.refresh();
                      refreshLiquidity();
                    }}
                    disabled={busy || refreshing}
                    aria-busy={refreshing}
                  >
                    {t(refreshing ? 'market.refreshing' : 'market.refreshData')}
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            {!market.error && (
              <div className="s-card" aria-label={t('market.loading')}>
                <h1 className="s-visually-hidden">{t('market.loading')}</h1>
                <Skeleton height={22} width="80%" />
                <Skeleton height={36} width="40%" />
                <Skeleton height={64} />
              </div>
            )}
            {status}
          </>
        )}
      </div>
    </section>
  );
}
