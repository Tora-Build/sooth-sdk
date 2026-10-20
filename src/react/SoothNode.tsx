import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { type Address } from 'viem';
import { factoryAddress, type FactoryCatalogMarket } from '../factory/schema.js';
import type { FactoryCatalogSnapshot } from '../factory/factoryCatalog.js';
import { SoothMarket } from './SoothMarket.js';
import { SoothCreateMarket } from './SoothCreateMarket.js';
import { useSoothRuntime } from './hooks.js';
import { describeSoothError } from './errors.js';
import type { SoothMarketSummary } from './data.js';
import { useSoothNodeMarkets } from './dataHooks.js';
import {
  formatSoothMarketReference,
  parseSoothMarketReference,
  type SoothHostEvent,
  type SoothMarketReference,
  type SoothTheme,
  type SoothVenue,
} from './embed.js';
import {
  formatSoothNodeReference,
  isSoothNodeScope,
  parseSoothNodeReference,
  soothNodeVenue,
  type SoothNodeFeatures,
  type SoothNodePresentation,
  type SoothNodeReference,
} from './node.js';
import type { SoothResolvedNode, SoothRuntime } from './runtime.js';
import type { SoothWalletAdapter } from './wallet.js';
import type { SoothTradeIntent } from './trading.js';
import { soothText, type SoothLocale } from './ui/i18n.js';
import { soothRootStyle } from './ui/theme.js';
import { Disclosure, Notice, Segmented, Skeleton } from './ui/primitives.js';
import {
  categoryLabel,
  matchesFilter,
  nodeCategories,
  nodeEntry,
  sortEntries,
  type SoothNodeEntry,
  type SoothNodeFilter,
  type SoothNodeSort,
} from './node/catalog.js';
import { SoothMarketCard } from './node/MarketCard.js';
import { soothNodeCss } from './node/styles.js';

export interface SoothNodeProps {
  node: string | SoothNodeReference;
  runtime?: SoothRuntime;
  wallet?: SoothWalletAdapter;
  features?: SoothNodeFeatures;
  presentation?: SoothNodePresentation;
  open?: boolean;
  onClose?: () => void;
  theme?: SoothTheme;
  appearance?: { accent?: string; radius?: number };
  locale?: SoothLocale;
  initialMarket?: Address;
  initialVenue?: SoothVenue;
  initialIntent?: SoothTradeIntent;
  initialView?: 'markets' | 'create';
  onEvent?: (event: SoothHostEvent) => void;
  onMarketChange?: (market: SoothMarketReference | undefined) => void;
  onWalletUnavailable?: (intent: SoothTradeIntent, market: SoothMarketReference) => void;
  onCreationWalletUnavailable?: () => void;
}

/** Cards rendered per step; summaries are read only for rendered cards. */
const PAGE_SIZE = 20;

/** Isolated styling; modal presentations use the browser's focus and inert handling. */
export function SoothNode(props: SoothNodeProps) {
  const container = useRef<HTMLDivElement>(null);
  const [root, setRoot] = useState<ShadowRoot | null>(null);
  useEffect(() => {
    if (container.current)
      setRoot(container.current.shadowRoot ?? container.current.attachShadow({ mode: 'open' }));
  }, []);
  let identity: string | undefined;
  let invalid: string | undefined;
  try {
    identity = formatSoothNodeReference(parseSoothNodeReference(props.node));
  } catch (reason) {
    invalid = describeSoothError(reason);
  }
  return (
    <div ref={container} data-sooth-node="v1">
      {root &&
        createPortal(
          <>
            <style>{soothNodeCss}</style>
            {identity ? (
              <NodeExperience key={identity} {...props} node={identity} />
            ) : (
              <div
                className="sooth-root s-node s-page"
                data-theme={props.theme ?? 'auto'}
                style={soothRootStyle(props.appearance)}
              >
                <Notice tone="error">
                  <p>{invalid}</p>
                </Notice>
              </div>
            )}
          </>,
          root,
        )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="7" cy="7" r="4.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.5 10.5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function outcomeIntent(outcome: 0 | 1, summary: SoothMarketSummary | undefined): SoothTradeIntent {
  const yes = summary?.yes ?? null;
  const cents =
    yes === null
      ? 50
      : Math.min(99, Math.max(1, Math.round((outcome === 1 ? yes : 1 - yes) * 100)));
  return { side: 'buy', outcome, shares: '', price: String(cents) };
}

function NodeExperience(props: SoothNodeProps) {
  const runtime = useSoothRuntime(props.runtime);
  const strings = useMemo(() => soothText(props.locale), [props.locale]);
  const { t } = strings;
  const text = useRef(strings);
  text.current = strings;
  const reference = useMemo(() => parseSoothNodeReference(props.node), [props.node]);
  const [resolved, setResolved] = useState<SoothResolvedNode | null>(null);
  const [catalog, setCatalog] = useState<FactoryCatalogSnapshot<FactoryCatalogMarket> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SoothNodeFilter>('open');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState<SoothNodeSort>('ending');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [now, setNow] = useState(() => Date.now());
  const [selected, setSelected] = useState<Address | undefined>(props.initialMarket);
  const [cardIntent, setCardIntent] = useState<
    { market: Address; intent: SoothTradeIntent } | undefined
  >();
  const [creating, setCreating] = useState(props.initialView === 'create');
  const [created, setCreated] = useState<Address | undefined>();
  const [requestedVenue, setRequestedVenue] = useState<SoothVenue>(props.initialVenue ?? 'amm');
  const venue = soothNodeVenue(props.features, requestedVenue);
  const presentation = props.presentation ?? 'panel';
  const [dismissed, setDismissed] = useState(false);
  const isOpen = props.open ?? !dismissed;
  const dialog = useRef<HTMLDialogElement>(null);
  const events = useRef(props.onEvent);
  const change = useRef(props.onMarketChange);
  const close = useRef(props.onClose);
  events.current = props.onEvent;
  change.current = props.onMarketChange;
  close.current = props.onClose;
  const id = useId();
  const requestClose = () => {
    if (props.open === undefined) setDismissed(true);
    close.current?.();
  };

  useEffect(() => {
    setSelected(props.initialMarket);
    setCreated(undefined);
    setCardIntent(undefined);
  }, [props.initialMarket]);
  useEffect(() => {
    setCreating(props.initialView === 'create');
  }, [props.initialView]);
  useEffect(() => {
    setRequestedVenue(props.initialVenue ?? 'amm');
  }, [props.initialVenue]);
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setLoading(true);
    setError(null);
    setResolved(null);
    setCatalog(null);
    if (!runtime) {
      setError(text.current.t('node.configure'));
      setLoading(false);
      return;
    }
    runtime
      .resolveNode(reference)
      .then((value) => {
        if (!active) return;
        if (
          formatSoothNodeReference(value.reference) !== formatSoothNodeReference(reference) ||
          !isSoothNodeScope(reference, value.context) ||
          !isSoothNodeScope(reference, value.node.node) ||
          value.node.node.releaseId.toLowerCase() !== reference.releaseId ||
          value.context.release.releaseId.toLowerCase() !== reference.releaseId ||
          value.catalog.items.some((item) => !isSoothNodeScope(reference, item.identity))
        )
          throw new Error(text.current.t('node.catalogMismatch'));
        setResolved(value);
        setCatalog(value.catalog);
        events.current?.({ type: 'ready' });
      })
      .catch((reason) => {
        if (active) setError(describeSoothError(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [runtime, reference, attempt, isOpen]);

  // Each refresh remains node scoped; a partial or foreign response never replaces the catalog.
  useEffect(() => {
    if (!resolved || !isOpen) return;
    let active = true;
    let timer: number;
    const refresh = async () => {
      try {
        const next = await resolved.refreshCatalog();
        if (next.items.some((item) => !isSoothNodeScope(reference, item.identity)))
          throw new Error(text.current.t('node.catalogMismatch'));
        if (active) {
          setCatalog(next);
          setError(null);
        }
      } catch (reason) {
        if (active) setError(describeSoothError(reason));
      } finally {
        if (active) timer = window.setTimeout(refresh, created ? 4_000 : 30_000);
      }
    };
    timer = window.setTimeout(refresh, created ? 0 : 30_000);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [resolved, reference, created, isOpen]);

  const record = catalog?.items.find(
    (item) => item.address.toLowerCase() === selected?.toLowerCase(),
  );
  const market = useMemo<SoothMarketReference | undefined>(
    () => (record ? { ...reference, market: record.address, venue } : undefined),
    [record, reference, venue],
  );
  useEffect(() => {
    if (catalog && isOpen)
      change.current?.(creating && props.features?.create ? undefined : market);
  }, [catalog, isOpen, market, creating, props.features?.create]);
  useEffect(() => {
    if (created && record) setCreated(undefined);
  }, [created, record]);

  // Defense at the child boundary: even custom runtime implementations cannot switch node/release.
  const scopedRuntime = useMemo<SoothRuntime | undefined>(
    () =>
      runtime && {
        resolveNode: async (input) => {
          const wanted = parseSoothNodeReference(input);
          if (formatSoothNodeReference(wanted) !== formatSoothNodeReference(reference))
            throw new Error(text.current.t('node.outOfScope'));
          return runtime.resolveNode(wanted);
        },
        resolve: async (input) => {
          const wanted = parseSoothMarketReference(input);
          if (
            !isSoothNodeScope(reference, wanted) ||
            wanted.releaseId !== reference.releaseId ||
            (!props.features?.clob && wanted.venue !== 'amm')
          )
            throw new Error(text.current.t('market.outOfScope'));
          const value = await runtime.resolve(wanted);
          if (
            formatSoothMarketReference(value.reference) !== formatSoothMarketReference(wanted) ||
            !isSoothNodeScope(reference, value.context) ||
            value.context.release.releaseId.toLowerCase() !== reference.releaseId
          )
            throw new Error(text.current.t('market.resolvedOutOfScope'));
          return value;
        },
      },
    [runtime, reference, props.features?.clob],
  );

  useEffect(() => {
    const element = dialog.current;
    if (!element || presentation === 'panel') return;
    if (!isOpen) {
      if (element.open) element.close();
      return;
    }
    let previous = element.ownerDocument.activeElement;
    while (previous?.shadowRoot?.activeElement) previous = previous.shadowRoot.activeElement;
    if (!element.open) element.showModal();
    return () => {
      if (element.open) element.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [presentation, isOpen]);

  const creatingView = creating && props.features?.create === true;
  const listView = isOpen && !loading && resolved !== null && !selected && !creatingView;

  // Browsing state: listed markets, then status and search, then category, then sort.
  const entries = useMemo(
    () => (catalog?.items ?? []).filter((item) => item.listing.state === 'listed').map(nodeEntry),
    [catalog],
  );
  const needle = query.toLowerCase().trim();
  const matching = useMemo(
    () =>
      entries.filter(
        (entry) =>
          matchesFilter(entry.item, filter) && entry.question.toLowerCase().includes(needle),
      ),
    [entries, filter, needle],
  );
  const categories = useMemo(() => {
    const counted = nodeCategories(matching);
    if (category === 'all' || counted.some((entry) => entry.id === category)) return counted;
    const chosen = entries.find((entry) => entry.category === category);
    return chosen ? [...counted, { id: category, text: chosen.categoryText, count: 0 }] : counted;
  }, [matching, entries, category]);
  const activeCategory = categories.some((entry) => entry.id === category) ? category : 'all';
  const [summaryCache, setSummaryCache] = useState<ReadonlyMap<string, SoothMarketSummary>>(
    () => new Map(),
  );
  const sorted = useMemo(
    () =>
      sortEntries(
        activeCategory === 'all'
          ? matching
          : matching.filter((entry) => entry.category === activeCategory),
        sort,
        summaryCache,
        now,
      ),
    [matching, activeCategory, sort, summaryCache, now],
  );
  const shown = sorted.slice(0, limit);
  const requestKey = shown
    .map((entry) => entry.item.address)
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
    .join(',');
  const requested = useMemo(
    () => (requestKey ? (requestKey.split(',') as Address[]) : []),
    [requestKey],
  );
  const summaries = useSoothNodeMarkets(listView ? resolved : null, requested);
  useEffect(() => {
    const data = summaries.data;
    if (!data) return;
    setSummaryCache((previous) => {
      const next = new Map(previous);
      for (const address of requested) {
        const summary = data.get(address);
        if (summary) next.set(address.toLowerCase(), summary);
        else next.delete(address.toLowerCase());
      }
      return next;
    });
  }, [summaries.data, requested]);
  useEffect(() => {
    if (!listView) return;
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [listView]);

  const browse = (update: () => void) => {
    update();
    setLimit(PAGE_SIZE);
  };
  const openMarket = (entry: SoothNodeEntry, outcome?: 0 | 1) => {
    const address = entry.item.address;
    setSelected(address);
    setRequestedVenue(soothNodeVenue(props.features, props.initialVenue));
    setCardIntent(
      outcome === undefined
        ? undefined
        : {
            market: address,
            intent: outcomeIntent(outcome, summaryCache.get(address.toLowerCase())),
          },
    );
  };
  const back = () => {
    setSelected(undefined);
    setCreated(undefined);
    setCreating(false);
    setCardIntent(undefined);
  };

  const emptyTitle =
    query || activeCategory !== 'all'
      ? t('node.noMatchTitle')
      : filter === 'resolved'
        ? t('node.noResolved')
        : filter === 'open'
          ? t('node.noOpen')
          : t('node.emptyTitle');
  const emptyBody = query
    ? t('node.noMatchBody')
    : filter !== 'all'
      ? t('node.browseAll')
      : props.features?.create
        ? t('node.emptyCreate')
        : t('node.emptyBody');

  const list = (
    <>
      <div className="s-node-tools">
        <div className="s-node-search">
          <label htmlFor={`${id}-search`} className="s-visually-hidden">
            {t('node.search')}
          </label>
          <SearchIcon />
          <input
            id={`${id}-search`}
            className="s-input"
            type="search"
            placeholder={t('node.searchPlaceholder')}
            value={query}
            onChange={(event) => {
              const value = event.target.value;
              browse(() => setQuery(value));
            }}
          />
        </div>
        <div className="s-node-filters">
          <Segmented
            label={t('node.statusFilter')}
            value={filter}
            onChange={(value) => browse(() => setFilter(value))}
            options={[
              { value: 'open', label: t('node.filterOpen') },
              { value: 'resolved', label: t('node.filterResolved') },
              { value: 'all', label: t('node.filterAll') },
            ]}
          />
          <label className="s-node-sort">
            <span className="s-visually-hidden">{t('node.sortBy')}</span>
            <select
              className="s-select"
              value={sort}
              onChange={(event) => {
                const value = event.target.value as SoothNodeSort;
                browse(() => setSort(value));
              }}
            >
              <option value="ending">{t('node.sortEnding')}</option>
              <option value="newest">{t('node.sortNewest')}</option>
              <option value="liquidity">{t('node.sortLiquidity')}</option>
            </select>
          </label>
        </div>
        {(categories.length > 1 || activeCategory !== 'all') && (
          <div role="group" aria-label={t('node.categories')} className="s-node-rail">
            {[
              { id: 'all', label: t('common.all'), count: matching.length },
              ...categories.map((entry) => ({
                id: entry.id,
                label: categoryLabel({ category: entry.id, categoryText: entry.text }, t),
                count: entry.count,
              })),
            ].map((chip) => (
              <button
                key={chip.id}
                type="button"
                className="s-chip s-node-cat"
                aria-pressed={activeCategory === chip.id}
                onClick={() => browse(() => setCategory(chip.id))}
              >
                {chip.label} <span className="s-node-cat-count">{chip.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {summaries.error && summaryCache.size === 0 && (
        <p className="s-small s-muted">{t('node.pricesUnavailable')}</p>
      )}
      {shown.length ? (
        <ul className="s-node-list">
          {shown.map((entry) => (
            <li key={entry.item.key}>
              <SoothMarketCard
                entry={entry}
                summary={summaryCache.get(entry.item.address.toLowerCase())}
                summaryLoading={summaries.loading}
                strings={strings}
                now={now}
                onOpen={(outcome) => openMarket(entry, outcome)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="s-node-empty">
          <h2>{emptyTitle}</h2>
          <p className="s-muted">{emptyBody}</p>
          {query && (
            <button
              type="button"
              className="s-btn s-btn-secondary s-btn-sm"
              onClick={() => browse(() => setQuery(''))}
            >
              {t('node.clearSearch')}
            </button>
          )}
        </div>
      )}
      {sorted.length > shown.length && (
        <div className="s-node-more">
          <span className="s-small s-muted">
            {t('node.showing', { shown: shown.length, total: sorted.length })}
          </span>
          <button
            type="button"
            className="s-btn s-btn-secondary"
            onClick={() => setLimit((value) => value + PAGE_SIZE)}
          >
            {t('common.showMore')}
          </button>
        </div>
      )}
      <p className="s-node-foot">
        {[
          t('node.provenance'),
          catalog?.indexed
            ? t('node.provenanceBlock', { block: catalog.indexed.blockNumber.toLocaleString() })
            : null,
          catalog?.facts.source === 'last-known-good' ? t('node.provenanceStale') : null,
          t('node.provenanceLive'),
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
    </>
  );

  const body = (
    <section
      className="sooth-root s-node"
      data-theme={props.theme ?? 'auto'}
      style={soothRootStyle(props.appearance)}
      aria-labelledby={`${id}-title`}
    >
      <div className="s-page">
        <header className="s-node-head">
          <div className="s-node-title">
            <span className="s-label">
              {t('node.title')}
              {listView && entries.length > 0
                ? ` · ${t('node.marketCount', { count: entries.length })}`
                : ''}
            </span>
            <h1 id={`${id}-title`}>{resolved?.node.metadata.label || t('node.explore')}</h1>
            {resolved?.node.metadata.description && listView && (
              <Disclosure summary={t('node.about')}>
                <p className="s-small s-muted">{resolved.node.metadata.description}</p>
              </Disclosure>
            )}
          </div>
          <div className="s-node-actions">
            {listView && props.features?.create && (
              <button
                type="button"
                className="s-btn s-btn-primary s-btn-sm"
                onClick={() => setCreating(true)}
              >
                {t('node.createMarket')}
              </button>
            )}
            {presentation !== 'panel' && (
              <button
                type="button"
                className="s-icon-btn"
                aria-label={t('node.closeMarkets')}
                onClick={requestClose}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                  <path
                    d="M3.5 3.5l9 9m0-9l-9 9"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            )}
          </div>
        </header>
        {loading && (
          <div className="s-node-list" role="status">
            <span className="s-visually-hidden">{t('node.loadingMarkets')}</span>
            <Skeleton className="s-node-skeleton" height={188} />
            <Skeleton className="s-node-skeleton" height={188} />
            <Skeleton className="s-node-skeleton" height={188} />
          </div>
        )}
        {error && (
          <Notice
            tone="error"
            title={resolved ? t('market.updatesUnavailable') : t('node.loadFailed')}
            action={
              <button
                type="button"
                className="s-btn s-btn-secondary s-btn-sm"
                onClick={() => setAttempt((value) => value + 1)}
              >
                {t('common.retry')}
              </button>
            }
          >
            <p>{error}</p>
          </Notice>
        )}
        {!loading && resolved && (
          <>
            {(selected || creatingView) && (
              <button
                type="button"
                className="s-btn s-btn-ghost s-btn-sm s-node-back"
                onClick={back}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                  <path
                    d="M10 3.5L5.5 8l4.5 4.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {t('node.allMarkets')}
              </button>
            )}
            {creatingView ? (
              <SoothCreateMarket
                node={resolved}
                wallet={props.wallet}
                theme={props.theme}
                appearance={props.appearance}
                locale={props.locale}
                onCancel={back}
                onWalletUnavailable={props.onCreationWalletUnavailable}
                onEvent={props.onEvent}
                onCreated={(address) => {
                  setCreated(factoryAddress(address));
                  setSelected(factoryAddress(address));
                  setCreating(false);
                  setRequestedVenue('amm');
                  setCardIntent(undefined);
                }}
              />
            ) : selected ? (
              market ? (
                <>
                  {props.features?.clob && (
                    <Segmented
                      label={t('market.tradingVenue')}
                      size="sm"
                      value={venue}
                      onChange={setRequestedVenue}
                      options={[
                        { value: 'amm', label: t('common.amm') },
                        { value: 'book', label: t('common.book') },
                      ]}
                    />
                  )}
                  <SoothMarket
                    market={market}
                    runtime={scopedRuntime}
                    wallet={props.wallet}
                    theme={props.theme}
                    appearance={props.appearance}
                    locale={props.locale}
                    onEvent={props.onEvent}
                    initialIntent={
                      cardIntent?.market.toLowerCase() === market.market.toLowerCase()
                        ? cardIntent.intent
                        : props.initialMarket?.toLowerCase() === market.market.toLowerCase()
                          ? props.initialIntent
                          : undefined
                    }
                    onWalletUnavailable={(intent) => props.onWalletUnavailable?.(intent, market)}
                  />
                </>
              ) : (
                <div className="s-node-empty" role="status">
                  <h2>{created ? t('create.createdTitle') : t('market.unavailable')}</h2>
                  <p className="s-muted">
                    {created ? t('create.indexing') : t('node.notInCatalog')}
                  </p>
                  <p className="s-num s-small">{selected}</p>
                  <button
                    type="button"
                    className="s-btn s-btn-secondary s-btn-sm"
                    onClick={() => setAttempt((value) => value + 1)}
                  >
                    {t('node.refreshCatalog')}
                  </button>
                </div>
              )
            ) : (
              list
            )}
          </>
        )}
      </div>
    </section>
  );
  return presentation === 'panel' ? (
    isOpen ? (
      body
    ) : null
  ) : (
    <dialog
      ref={dialog}
      data-presentation={presentation}
      aria-labelledby={`${id}-title`}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
    >
      {isOpen ? body : null}
    </dialog>
  );
}
