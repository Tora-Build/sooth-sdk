import { useId } from 'react';
import type { SoothMarketSummary } from '../data.js';
import { Badge, Skeleton } from '../ui/primitives.js';
import {
  formatCents,
  formatCompactToken,
  formatCountdown,
  formatDeadline,
  formatProbability,
} from '../ui/format.js';
import type { SoothStrings } from '../ui/i18n.js';
import { categoryLabel, type SoothNodeEntry } from './catalog.js';

export interface SoothMarketCardProps {
  entry: SoothNodeEntry;
  /** Live summary at one block; undefined until read or when the market could not be read. */
  summary: SoothMarketSummary | undefined;
  summaryLoading: boolean;
  strings: SoothStrings;
  now: number;
  /** Opens the market; an outcome preselects a buy of that outcome. */
  onOpen: (outcome?: 0 | 1) => void;
}

/** Mobile card: category and status, question, YES/NO entry points, liquidity and deadline. */
export function SoothMarketCard({
  entry,
  summary,
  summaryLoading,
  strings,
  now,
  onOpen,
}: SoothMarketCardProps) {
  const { t, locale } = strings;
  const titleId = useId();
  const { item } = entry;
  const settled = item.state.phase === 'settled';
  const tradingOpen = summary?.tradingOpen ?? item.tradingOpen === true;
  const status = settled
    ? t('node.filterResolved')
    : tradingOpen
      ? t('node.filterOpen')
      : item.state.phase === 'live'
        ? t('node.filterClosed')
        : t('market.statusResolving');
  const result =
    settled && item.state.outcome !== null
      ? item.state.outcome === 1
        ? t('market.yesWon')
        : item.state.outcome === 0
          ? t('market.noWon')
          : t('market.invalidResult')
      : null;
  const yes = summary?.yes ?? null;
  const pending = summaryLoading && !summary;
  const deadline = Number(summary?.deadline ?? item.deadline);
  const countdown = Number.isFinite(deadline) ? formatCountdown(deadline, locale, now) : '';
  return (
    <article className="s-card s-node-card" aria-labelledby={titleId}>
      <div className="s-node-card-tags">
        <Badge>{categoryLabel(entry, t)}</Badge>
        <Badge tone={settled ? 'strong' : tradingOpen ? 'live' : 'outline'}>{status}</Badge>
      </div>
      <button type="button" className="s-node-card-open" onClick={() => onOpen()}>
        <h3 id={titleId}>{entry.question || t('node.untitled')}</h3>
        {!settled && (
          <span className="s-node-prob">
            {pending ? (
              <Skeleton width={56} height={20} />
            ) : (
              <span className="s-num s-node-prob-value">{formatProbability(yes)}</span>
            )}
            <span className="s-muted s-small">
              {yes === null && !pending ? t('node.probabilityUnavailable') : t('market.chance')}
            </span>
          </span>
        )}
      </button>
      {result ? (
        <p className="s-node-result">{result}</p>
      ) : settled ? (
        <p className="s-node-result">{t('market.awaitingResult')}</p>
      ) : (
        <div className="s-node-prices">
          {([1, 0] as const).map((outcome) => (
            <button
              key={outcome}
              type="button"
              className={`s-btn ${outcome === 1 ? 's-btn-yes' : 's-btn-no'} s-node-price`}
              aria-describedby={titleId}
              disabled={!tradingOpen}
              onClick={() => onOpen(outcome)}
            >
              <span>{t(outcome === 1 ? 'common.yes' : 'common.no')}</span>
              {pending ? (
                <Skeleton width={40} height={14} />
              ) : (
                <span className="s-num">
                  {formatCents(yes === null ? null : outcome === 1 ? yes : 1 - yes, 0)}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      <div className="s-node-meta">
        <span>
          {t('node.liquidity')}{' '}
          {pending ? (
            <Skeleton width={48} height={12} />
          ) : (
            <span className="s-num">
              {summary && summary.liquidityNative !== null
                ? formatCompactToken(
                    summary.liquidityNative,
                    summary.tokenDecimals,
                    summary.tokenSymbol,
                    locale,
                  )
                : '—'}
            </span>
          )}
        </span>
        <span title={formatDeadline(deadline, locale)}>
          {countdown
            ? t('common.timeLeft', { time: countdown })
            : t('common.endedOn', { date: formatDeadline(deadline, locale) })}
        </span>
      </div>
    </article>
  );
}
