import { useId, type ReactNode } from 'react';
import { formatUnits } from 'viem';
import { centsToTick } from '../../factory/factoryTrade/bookOrder.js';
import { useSoothLiveQuote } from '../dataHooks.js';
import type { SoothMarketData, SoothResolvedMarket } from '../runtime.js';
import type { SoothMarketActions } from '../tradeFlow.js';
import {
  formatBps,
  formatCents,
  formatPercent,
  formatShares,
  formatTokenWithSymbol,
} from '../ui/format.js';
import type { SoothStrings } from '../ui/i18n.js';
import { Chips, Disclosure, Notice, Segmented, Spinner } from '../ui/primitives.js';
import { exactToken, sellableShares, validShares, yesProbability } from './shared.js';

const PRESETS = ['10', '50', '100', '500'];
/** Demo SimpleTradingPanel thresholds on the traded outcome's price move. */
const IMPACT_WARN = 0.02;
const IMPACT_HIGH = 0.05;

export interface TradePanelProps {
  strings: SoothStrings;
  resolved: SoothResolvedMarket;
  data: SoothMarketData;
  actions: SoothMarketActions;
  /** Connect or switch-network action replacing review, if needed. */
  walletAction: ReactNode;
}

/**
 * Ticket with a display-only live quote. Review, approval and confirmation always go through
 * `useSoothMarketActions`, which re-plans from fresh chain reads; the live quote never signs.
 */
export function TradePanel({ strings, resolved, data, actions, walletAction }: TradePanelProps) {
  const { t } = strings;
  const id = useId();
  const { intent, preview, busy, hasPending, ready } = actions;
  const { token } = data;
  const book = resolved.reference.venue === 'book';
  const buy = intent.side === 'buy';
  const outcomeLabel = intent.outcome === 1 ? t('common.yes') : t('common.no');
  const update = (patch: Partial<typeof intent>) => actions.setIntent({ ...intent, ...patch });
  const sellable = sellableShares(data, intent.outcome);
  const yes = yesProbability(data);
  const sharesValid = validShares(intent.shares);
  const tickValid = !book || centsToTick(intent.price) !== null;
  const quote = useSoothLiveQuote(resolved, sharesValid && tickValid ? intent : null);
  const maxShares = !buy && sellable !== null && sellable > 0n ? formatUnits(sellable, 18) : null;
  const chips = [
    ...PRESETS.map((value) => ({ value, label: value })),
    ...(maxShares === null ? [] : [{ value: 'max', label: t('common.max') }]),
  ];
  const chipValue = PRESETS.includes(intent.shares)
    ? intent.shares
    : maxShares !== null && intent.shares === maxShares
      ? 'max'
      : null;
  const impact = quote.data && !book ? Math.abs(quote.data.priceImpact) : 0;
  return (
    <section className="s-card" aria-label={t('trade.title')}>
      <form
        className="s-stack"
        aria-label={t('trade.shares')}
        onSubmit={(event) => {
          event.preventDefault();
          void actions.review();
        }}
      >
        <Segmented
          label={t('trade.side')}
          value={intent.side}
          onChange={(side) => update({ side })}
          options={[
            { value: 'buy', label: t('common.buy') },
            { value: 'sell', label: t('common.sell') },
          ]}
        />
        <Segmented
          label={t('trade.outcome')}
          value={intent.outcome === 1 ? 'yes' : 'no'}
          onChange={(value) => update({ outcome: value === 'yes' ? 1 : 0 })}
          options={[
            {
              value: 'yes',
              label: (
                <>
                  {t('common.yes')}
                  <span className="s-seg-price" aria-hidden="true">
                    {formatCents(yes)}
                  </span>
                </>
              ),
              outcome: 'yes',
            },
            {
              value: 'no',
              label: (
                <>
                  {t('common.no')}
                  <span className="s-seg-price" aria-hidden="true">
                    {formatCents(yes === null ? null : 1 - yes)}
                  </span>
                </>
              ),
              outcome: 'no',
            },
          ]}
        />
        <div className="s-field">
          <label className="s-field-label" htmlFor={`${id}-shares`}>
            {t('common.shares')}
          </label>
          <div className="s-input-wrap">
            <input
              id={`${id}-shares`}
              className="s-input s-input-num"
              inputMode="decimal"
              autoComplete="off"
              value={intent.shares}
              onChange={(event) => update({ shares: event.target.value })}
              placeholder="0.00"
              aria-describedby={`${id}-units`}
            />
            <span className="s-input-suffix" aria-hidden="true">
              {outcomeLabel}
            </span>
          </div>
          <span id={`${id}-units`} className="s-field-hint">
            {t('trade.sharesHint', { symbol: token.symbol })}{' '}
            {buy
              ? data.account &&
                t('trade.available', {
                  amount: formatTokenWithSymbol(data.account.balance, token.decimals, token.symbol),
                })
              : sellable !== null && t('trade.owned', { amount: formatShares(sellable) })}
          </span>
        </div>
        <Chips
          label={t('trade.presets')}
          options={chips}
          value={chipValue}
          onSelect={(value) => update({ shares: value === 'max' ? (maxShares ?? '') : value })}
        />
        {book && (
          <div className="s-field">
            <label className="s-field-label" htmlFor={`${id}-price`}>
              {t('trade.limitPriceCents')}
            </label>
            <div className="s-input-wrap">
              <input
                id={`${id}-price`}
                className="s-input s-input-num"
                inputMode="decimal"
                autoComplete="off"
                value={intent.price}
                aria-invalid={!tickValid}
                aria-describedby={`${id}-tick`}
                onChange={(event) => update({ price: event.target.value })}
              />
              <span className="s-input-suffix" aria-hidden="true">
                ¢
              </span>
            </div>
            <span id={`${id}-tick`} className="s-field-hint">
              {t('trade.tickHint')}
            </span>
          </div>
        )}
        {!preview && sharesValid && tickValid && (
          <section className="s-quote" aria-label={t('trade.quoteTitle')} aria-live="polite">
            {quote.data ? (
              <>
                <div className="s-kv">
                  <span>{buy ? t('trade.youPay') : t('trade.youReceive')}</span>
                  <span>
                    {formatTokenWithSymbol(
                      quote.data.amountNative,
                      token.decimals,
                      token.symbol,
                      4,
                    )}
                  </span>
                </div>
                <div className="s-kv">
                  <span>{t('trade.fee')}</span>
                  <span>
                    {formatTokenWithSymbol(quote.data.feeNative, token.decimals, token.symbol, 4)}
                  </span>
                </div>
                <div className="s-kv">
                  <span>{book ? t('trade.limit') : t('trade.avgPrice')}</span>
                  <span>{formatCents(quote.data.averagePrice)}</span>
                </div>
                <div className="s-kv">
                  <span>{t('trade.probability')}</span>
                  <span>
                    {t('trade.probabilityChange', {
                      before: formatPercent(quote.data.priceBefore),
                      after: formatPercent(quote.data.priceAfter),
                    })}
                  </span>
                </div>
                {!book && (
                  <div
                    className="s-kv"
                    data-impact={
                      impact > IMPACT_HIGH ? 'high' : impact > IMPACT_WARN ? 'warn' : 'low'
                    }
                  >
                    <span>{t('trade.priceImpact')}</span>
                    <span>
                      {quote.data.priceImpact > 0 ? '+' : ''}
                      {formatPercent(quote.data.priceImpact, 2)}
                    </span>
                  </div>
                )}
                {impact > IMPACT_HIGH ? (
                  <Notice tone="error">{t('trade.impactHigh')}</Notice>
                ) : impact > IMPACT_WARN ? (
                  <Notice tone="warn">{t('trade.impactWarn')}</Notice>
                ) : null}
              </>
            ) : quote.error ? (
              <p className="s-small s-muted">
                {t('trade.quoteUnavailable')}: {quote.error}
              </p>
            ) : (
              <p className="s-small s-muted">
                <Spinner /> {t('trade.quoteLoading')}
              </p>
            )}
            <p className="s-small s-muted">{t('trade.quoteNote')}</p>
          </section>
        )}
        <p className="s-small s-muted">{book ? t('trade.bookNotice') : t('trade.slippageNote')}</p>
        {walletAction ??
          (!preview && (
            <button type="submit" className="s-btn s-btn-primary s-btn-block" disabled={!ready}>
              {hasPending
                ? t('tx.pending')
                : busy
                  ? t('trade.preparing')
                  : buy
                    ? t('trade.reviewBuy')
                    : t('trade.reviewSell')}
            </button>
          ))}
      </form>
      {preview && (
        <section className="s-card s-card-flat" aria-label={t('trade.reviewTitle')}>
          <h3>
            {buy
              ? t('trade.buyOutcome', { outcome: outcomeLabel })
              : t('trade.sellOutcome', { outcome: outcomeLabel })}
          </h3>
          <p>{preview.description}</p>
          <div className="s-kv">
            <span>{t('market.venueFee')}</span>
            <span>{formatBps(preview.feeBps)}</span>
          </div>
          <div className="s-kv">
            <span>{t('trade.maxTokenInput')}</span>
            <span>{exactToken(preview.requiredNative, token)}</span>
          </div>
          {preview.boundWad !== undefined && (
            <div className="s-kv">
              <span>{buy ? t('trade.maxSpend') : t('trade.minProceeds')}</span>
              <span>
                {formatUnits(preview.boundWad, 18)} {token.symbol}
              </span>
            </div>
          )}
          {preview.approveNative !== null ? (
            <>
              <p>
                {t('trade.authorizeOnly', {
                  amount: exactToken(preview.approveNative, token),
                  venue: book ? t('common.book') : t('common.amm'),
                })}
              </p>
              <Disclosure summary={t('trade.approvalRecipient')}>
                <code>
                  {book ? resolved.context.contracts.book : resolved.context.contracts.amm}
                </code>
              </Disclosure>
              {preview.allowance > 0n ? (
                <>
                  <p>{t('trade.resetFirst')}</p>
                  <button
                    type="button"
                    className="s-btn s-btn-primary s-btn-block"
                    onClick={() => void actions.approve()}
                    disabled={!ready}
                  >
                    {t('trade.resetAllowance')}
                  </button>
                </>
              ) : (
                <>
                  <p className="s-small s-muted">
                    {t('trade.unlimitedNote', { symbol: token.symbol })}
                  </p>
                  <button
                    type="button"
                    className="s-btn s-btn-primary s-btn-block"
                    onClick={() => void actions.approve('exact')}
                    disabled={!ready}
                  >
                    {t('trade.approveExact')}
                  </button>
                  <button
                    type="button"
                    className="s-btn s-btn-secondary s-btn-block"
                    onClick={() => void actions.approve('unlimited')}
                    disabled={!ready}
                  >
                    {t('trade.approveUnlimited', { symbol: token.symbol })}
                  </button>
                </>
              )}
            </>
          ) : (
            <button
              type="button"
              className="s-btn s-btn-primary s-btn-block"
              onClick={() => void actions.submit()}
              disabled={!ready}
            >
              {buy ? t('trade.confirmBuy') : t('trade.confirmSell')}
            </button>
          )}
          <button
            type="button"
            className="s-btn s-btn-ghost s-btn-block"
            onClick={actions.clearReview}
            disabled={busy}
          >
            {t('common.cancel')}
          </button>
        </section>
      )}
    </section>
  );
}
