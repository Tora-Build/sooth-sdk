import type { Address } from 'viem';
import { parseSQFSafe } from '../../lib/sqf.js';
import type { SoothDepth, SoothMarketSummary } from '../data.js';
import type { SoothDataState } from '../dataHooks.js';
import { formatSoothMarketReference } from '../embed.js';
import type { SoothMarketData, SoothResolvedMarket } from '../runtime.js';
import {
  formatBps,
  formatCompact,
  formatCompactToken,
  formatDeadline,
  formatTokenWithSymbol,
  tokenAmountToNumber,
} from '../ui/format.js';
import type { SoothStrings } from '../ui/i18n.js';
import { Disclosure, Stat } from '../ui/primitives.js';
import { CopyValue } from './shared.js';

export interface MarketStatsProps {
  strings: SoothStrings;
  resolved: SoothResolvedMarket;
  data: SoothMarketData;
  summary: SoothDataState<SoothMarketSummary>;
  depth: SoothDataState<SoothDepth> | null;
}

/** Liquidity, fee, deadline and collateral (Mobile det-stats). */
export function MarketStats({ strings, resolved, data, summary, depth }: MarketStatsProps) {
  const { t, locale } = strings;
  const { snapshot, token } = data;
  const book = resolved.reference.venue === 'book';
  let liquidity = '—';
  if (book && depth?.data) {
    const resting = [...depth.data.bids, ...depth.data.asks].reduce(
      (sum, level) => sum + level.shares,
      0n,
    );
    liquidity = t('market.sharesAmount', {
      amount: formatCompact(tokenAmountToNumber(resting, 18), locale),
    });
  } else if (!book && summary.data && summary.data.liquidityNative !== null) {
    liquidity = formatCompactToken(
      summary.data.liquidityNative,
      summary.data.tokenDecimals,
      summary.data.tokenSymbol,
      locale,
    );
  }
  return (
    <dl className="s-stats s-market-stats" aria-label={t('market.stats')}>
      <Stat label={t('market.liquidity')} value={liquidity} />
      <Stat
        label={book ? t('market.bookFee') : t('market.ammFee')}
        value={formatBps(book ? snapshot.bookFeeBps : snapshot.ammFeeBps)}
      />
      <Stat label={t('common.deadline')} value={formatDeadline(snapshot.deadline, locale)} />
      <Stat label={t('market.token')} value={token.symbol} />
    </dl>
  );
}

export interface MarketDetailsProps {
  strings: SoothStrings;
  resolved: SoothResolvedMarket;
  data: SoothMarketData;
  account: Address | undefined;
}

/** SQF rules plus contract identities (Demo MarketDetailsCard), collapsed by default. */
export function MarketDetails({ strings, resolved, data, account }: MarketDetailsProps) {
  const { t, locale } = strings;
  const { snapshot, token } = data;
  const { reference } = resolved;
  const book = reference.venue === 'book';
  const terms = parseSQFSafe(resolved.record.question);
  const ruleFields = Object.entries(terms.rule).filter(
    (entry): entry is [string, string] =>
      entry[0] !== 'description' && typeof entry[1] === 'string',
  );
  const description = terms.rule.description ?? (ruleFields.length ? null : resolved.rules);
  return (
    <section className="s-card" aria-label={t('common.details')}>
      <Disclosure summary={t('market.rules')}>
        {description && <p className="s-pre">{description}</p>}
        {terms.category && (
          <div className="s-kv">
            <span>{t('market.category')}</span>
            <span>{terms.category}</span>
          </div>
        )}
        {terms.event && (
          <div className="s-kv">
            <span>{t('market.event')}</span>
            <span>{terms.event}</span>
          </div>
        )}
        {ruleFields.map(([key, value]) => (
          <div className="s-rule-field" key={key}>
            <span>{key}</span>
            <span className="s-pre">{value}</span>
          </div>
        ))}
      </Disclosure>
      <Disclosure summary={t('market.details')}>
        <div className="s-kv">
          <span>{t('common.network')}</span>
          <span>{t('market.chainId', { id: reference.chainId })}</span>
        </div>
        <div className="s-kv">
          <span>{t('common.venue')}</span>
          <span>{book ? t('common.book') : t('common.amm')}</span>
        </div>
        <div className="s-kv">
          <span>{book ? t('market.bookFee') : t('market.ammFee')}</span>
          <span>{formatBps(book ? snapshot.bookFeeBps : snapshot.ammFeeBps)}</span>
        </div>
        <div className="s-kv">
          <span>{t('market.tradingDeadline')}</span>
          <span>{formatDeadline(snapshot.deadline, locale)}</span>
        </div>
        <div className="s-kv">
          <span>{t('common.collateral')}</span>
          <span>
            {token.symbol} ({token.decimals})
          </span>
        </div>
        <CopyValue strings={strings} label={t('market.token')} value={token.address} />
        <CopyValue strings={strings} label={t('market.adjudicator')} value={snapshot.adjudicator} />
        <CopyValue strings={strings} label={t('market.address')} value={reference.market} />
        <CopyValue strings={strings} label={t('market.node')} value={reference.nodeId} />
        {account && (
          <div className="s-kv">
            <span>{t('common.wallet')}</span>
            <code>{account}</code>
          </div>
        )}
        {data.account && (
          <div className="s-kv">
            <span>{t('trade.currentAllowance')}</span>
            <span>
              {formatTokenWithSymbol(data.account.allowance, token.decimals, token.symbol, 4)}
            </span>
          </div>
        )}
        <p className="s-small">
          {t('market.identity')}: <code>{formatSoothMarketReference(reference)}</code>
        </p>
        <p className="s-small s-muted">{t('market.allowanceNote')}</p>
        <p className="s-small s-muted">{t('market.policyNote')}</p>
        <a href={resolved.canonicalUrl} target="_blank" rel="noopener noreferrer">
          {t('market.openInSooth')}
        </a>
      </Disclosure>
    </section>
  );
}
