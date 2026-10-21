import type { SoothMarketData, SoothResolvedMarket } from '../runtime.js';
import {
  countdownTo,
  formatCents,
  formatCountdown,
  formatDeadline,
  formatPercent,
} from '../ui/format.js';
import type { SoothStrings } from '../ui/i18n.js';
import { Badge, Notice } from '../ui/primitives.js';
import { useNow, yesProbability } from './shared.js';

export interface MarketHeaderProps {
  strings: SoothStrings;
  resolved: SoothResolvedMarket;
  data: SoothMarketData;
  tradingOpen: boolean;
  /** The latest read succeeded and trading is open. */
  live: boolean;
}

/** Question, status, deadline, venue and the YES/NO prices (Mobile MarketDetailM header). */
export function MarketHeader({ strings, resolved, data, tradingOpen, live }: MarketHeaderProps) {
  const { t, locale } = strings;
  const { snapshot } = data;
  const now = useNow(30_000);
  const book = resolved.reference.venue === 'book';
  const resultLabel =
    snapshot.outcome === 1
      ? t('common.yes')
      : snapshot.outcome === 0
        ? t('common.no')
        : t('market.invalid');
  const status = snapshot.settled
    ? t('market.badgeResolved', { outcome: resultLabel })
    : tradingOpen
      ? t('market.statusOpen')
      : snapshot.isResolving
        ? t('market.statusResolving')
        : t('market.statusClosed');
  const deadlineText = formatDeadline(snapshot.deadline, locale);
  const remaining = countdownTo(snapshot.deadline, now);
  const yes = yesProbability(data);
  const cards = [
    { outcome: 1 as const, key: 'yes' as const, price: yes },
    { outcome: 0 as const, key: 'no' as const, price: yes === null ? null : 1 - yes },
  ];
  return (
    <header className="s-card">
      <div className="s-row s-wrap">
        <Badge tone={snapshot.settled ? 'strong' : tradingOpen ? 'live' : 'default'}>
          {status}
        </Badge>
        <Badge tone="outline">{book ? t('common.book') : t('common.amm')}</Badge>
        <Badge>{data.token.symbol}</Badge>
        <span className="s-small s-muted s-num s-push" title={deadlineText}>
          {remaining.expired
            ? t('common.endedOn', { date: deadlineText })
            : t('common.timeLeft', { time: formatCountdown(snapshot.deadline, locale, now) })}
        </span>
      </div>
      <h1>{resolved.question}</h1>
      {snapshot.settled ? (
        <section className="s-card s-card-flat" aria-label={t('market.result')}>
          <p className="s-label">{t('market.finalResult')}</p>
          <h2>{t('market.resolvedOutcome', { outcome: resultLabel })}</h2>
          <p className="s-muted">
            {snapshot.outcome === 2 ? t('market.invalidBody') : t('market.tradingEnded')}
          </p>
        </section>
      ) : (
        <section className="s-stack" aria-label={t('market.probability')}>
          <span className="s-small s-muted">
            {live ? t('market.liveProbability') : t('market.lastProbability')}
          </span>
          {yes !== null ? (
            <>
              <div className="s-prob">{formatPercent(yes)}</div>
              <div className="s-meter" aria-hidden="true">
                <span style={{ width: `${yes * 100}%` }} />
              </div>
            </>
          ) : (
            <p>{t('market.probabilityUnavailable')}</p>
          )}
          {book && <p className="s-small s-muted">{t('market.referenceProbability')}</p>}
          {/* While trading is open the trade panel's YES/NO control shows the prices and is the
              one place to pick an outcome; the cards show them only when there is no panel. */}
          {!tradingOpen && (
            <div className="s-price-cards">
              {cards.map((card) => (
                <div
                  key={card.key}
                  className="s-price-card s-price-card-static"
                  data-outcome={card.key}
                >
                  <span className="s-price-card-label">
                    {card.outcome === 1 ? t('common.yes') : t('common.no')}
                  </span>
                  <span className="s-price-card-value">{formatCents(card.price)}</span>
                </div>
              ))}
            </div>
          )}
          {!tradingOpen && (
            <Notice>
              {snapshot.isResolving ? t('market.resolving') : t('market.awaitingResult')}
            </Notice>
          )}
        </section>
      )}
    </header>
  );
}
