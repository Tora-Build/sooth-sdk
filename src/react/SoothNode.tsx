import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { type Address } from 'viem';
import { factoryAddress, type FactoryCatalogMarket } from '../factory/schema.js';
import type { FactoryCatalogSnapshot } from '../factory/factoryCatalog.js';
import { parseSQFSafe } from '../lib/sqf.js';
import { SoothMarket } from './SoothMarket.js';
import { SoothCreateMarket } from './SoothCreateMarket.js';
import { useSoothRuntime } from './hooks.js';
import { describeSoothError } from './errors.js';
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
  initialMarket?: Address;
  initialVenue?: SoothVenue;
  initialIntent?: SoothTradeIntent;
  initialView?: 'markets' | 'create';
  onEvent?: (event: SoothHostEvent) => void;
  onMarketChange?: (market: SoothMarketReference | undefined) => void;
  onWalletUnavailable?: (intent: SoothTradeIntent, market: SoothMarketReference) => void;
  onCreationWalletUnavailable?: () => void;
}

const styles = `
:host{display:block;min-width:0;font:15px/1.5 system-ui,sans-serif;color-scheme:light dark}
*,*:before,*:after{box-sizing:border-box}.node{--bg:#fff;--fg:#17202d;--muted:#566275;--line:#dce2eb;--sub:#f4f6fa;background:var(--bg);color:var(--fg);border:1px solid var(--line);border-radius:var(--sooth-radius,16px);padding:24px;width:100%;min-width:0;overflow-wrap:anywhere}.node[data-theme=dark]{--bg:#141a25;--fg:#f2f5fc;--muted:#b0bdd0;--line:#364256;--sub:#202a3a;color-scheme:dark}@media(prefers-color-scheme:dark){.node[data-theme=auto]{--bg:#141a25;--fg:#f2f5fc;--muted:#b0bdd0;--line:#364256;--sub:#202a3a;color-scheme:dark}}
dialog{padding:0;border:0;background:transparent;color:inherit;max-height:100dvh;max-width:100vw;overflow:auto}dialog::backdrop{background:rgb(10 17 30 / .55);backdrop-filter:blur(3px)}dialog[data-presentation=modal]{width:min(960px,calc(100vw - 48px));margin:auto}dialog[data-presentation=drawer]{width:min(480px,100vw);height:100dvh;max-height:100dvh;margin:0 0 0 auto}dialog[data-presentation=drawer]>.node{min-height:100%;border-radius:var(--sooth-radius,16px) 0 0 var(--sooth-radius,16px)}
h2,h3,p{margin:0}h2{font-size:1.55rem;line-height:1.25}h3{font-size:1.05rem;line-height:1.4}.eyebrow{text-transform:uppercase;letter-spacing:.09em;font-size:.72rem;font-weight:750;color:var(--sooth-accent,#315ed8)}.muted{color:var(--muted);font-size:.85rem}.header,.toolbar,.tabs,.meta{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.header{align-items:flex-start;justify-content:space-between;margin-bottom:22px}.title{flex:1;min-width:160px}.title p{margin-top:8px}.toolbar{margin:18px 0}.search{flex:1;min-width:160px}.tabs{gap:6px}button,input,select{font:inherit}button{cursor:pointer;min-height:44px;padding:10px 15px;border:1px solid transparent;border-radius:10px;background:var(--sooth-accent,#315ed8);color:white;font-weight:650}button.secondary{background:var(--sub);color:var(--fg);border-color:var(--line)}button[aria-pressed=true]{border-color:var(--sooth-accent,#315ed8);box-shadow:inset 0 0 0 1px var(--sooth-accent,#315ed8)}button:disabled{opacity:.55;cursor:wait}input,select{width:100%;min-height:44px;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--fg)}label{display:block;font-size:.85rem;font-weight:650;margin-bottom:4px}:focus-visible{outline:3px solid var(--sooth-accent,#315ed8);outline-offset:3px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:12px;list-style:none;padding:0;margin:18px 0}.card{display:flex;flex-direction:column;gap:16px;width:100%;height:100%;text-align:left;background:var(--bg);color:var(--fg);border:1px solid var(--line);padding:18px;font-weight:400}.card:hover{border-color:var(--sooth-accent,#315ed8);background:var(--sub)}.card .meta{justify-content:space-between;margin-top:auto;font-size:.8rem;color:var(--muted)}.status{font-size:.72rem;font-weight:700;border-radius:20px;padding:4px 9px;background:var(--sub);align-self:flex-start}.outcome{font-size:1.15rem;font-weight:750}.empty,.notice{padding:22px;border:1px solid var(--line);border-radius:12px;background:var(--sub);margin:16px 0}.empty p,.notice p{margin:8px 0 14px}.error{border-color:#b34343}.provenance{padding-top:16px;border-top:1px solid var(--line)}.back{margin-bottom:16px}.venue{margin-bottom:16px}.address{font-family:ui-monospace,monospace;font-size:.8rem}
@media(max-width:520px){.node{padding:18px;border-radius:12px}dialog[data-presentation=modal],dialog[data-presentation=drawer]{width:100vw;height:100dvh;max-height:100dvh;margin:0}dialog[data-presentation]>.node{min-height:100%;border-radius:0}.header{gap:8px}.toolbar{align-items:stretch}.tabs{width:100%}.tabs button{flex:1;padding:8px}}
`;

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
            <style>{styles}</style>
            {identity ? (
              <NodeExperience key={identity} {...props} node={identity} />
            ) : (
              <div role="alert">{invalid}</div>
            )}
          </>,
          root,
        )}
    </div>
  );
}

function NodeExperience(props: SoothNodeProps) {
  const runtime = useSoothRuntime(props.runtime);
  const reference = useMemo(() => parseSoothNodeReference(props.node), [props.node]);
  const [resolved, setResolved] = useState<SoothResolvedNode | null>(null);
  const [catalog, setCatalog] = useState<FactoryCatalogSnapshot<FactoryCatalogMarket> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'open' | 'resolved' | 'all'>('open');
  const [selected, setSelected] = useState<Address | undefined>(props.initialMarket);
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
      setError('Configure a Sooth runtime to load this node.');
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
          throw new Error('The returned catalog does not belong to the configured node.');
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
          throw new Error('The returned catalog does not belong to the configured node.');
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
            throw new Error('Node is outside this embed.');
          return runtime.resolveNode(wanted);
        },
        resolve: async (input) => {
          const wanted = parseSoothMarketReference(input);
          if (
            !isSoothNodeScope(reference, wanted) ||
            wanted.releaseId !== reference.releaseId ||
            (!props.features?.clob && wanted.venue !== 'amm')
          )
            throw new Error('Market is outside this embed.');
          const value = await runtime.resolve(wanted);
          if (
            formatSoothMarketReference(value.reference) !== formatSoothMarketReference(wanted) ||
            !isSoothNodeScope(reference, value.context) ||
            value.context.release.releaseId.toLowerCase() !== reference.releaseId
          )
            throw new Error('Resolved market is outside this embed.');
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

  const back = () => {
    setSelected(undefined);
    setCreated(undefined);
    setCreating(false);
  };
  const appearance = {
    '--sooth-accent': props.appearance?.accent,
    '--sooth-radius':
      props.appearance?.radius === undefined
        ? undefined
        : `${Math.max(0, Math.min(32, props.appearance.radius))}px`,
  } as CSSProperties;
  const visible =
    catalog?.items.filter(
      (item) =>
        item.listing.state === 'listed' &&
        (filter === 'all' ||
          (filter === 'resolved' ? item.state.phase === 'settled' : item.tradingOpen === true)) &&
        (parseSQFSafe(item.question).question || item.question)
          .toLowerCase()
          .includes(query.toLowerCase().trim()),
    ) ?? [];
  const body = (
    <section
      className="node"
      data-theme={props.theme ?? 'auto'}
      style={appearance}
      aria-labelledby={`${id}-title`}
    >
      <header className="header">
        <div className="title">
          <div className="eyebrow">Prediction markets</div>
          <h2 id={`${id}-title`}>{resolved?.node.metadata.label || 'Explore markets'}</h2>
          {resolved?.node.metadata.description && (
            <details className="muted">
              <summary>About this node</summary>
              <p>{resolved.node.metadata.description}</p>
            </details>
          )}
        </div>
        {presentation !== 'panel' && (
          <button className="secondary" aria-label="Close markets" onClick={requestClose}>
            Close
          </button>
        )}
      </header>
      {loading && (
        <div className="empty" role="status">
          <h3>Loading markets…</h3>
          <p>Connecting to this node and checking its release.</p>
        </div>
      )}
      {error && (
        <div className="notice error" role="alert">
          <h3>{resolved ? 'Market updates are unavailable' : 'Unable to load markets'}</h3>
          <p>{error}</p>
          <button className="secondary" onClick={() => setAttempt((value) => value + 1)}>
            Try again
          </button>
        </div>
      )}
      {!loading && resolved && (
        <>
          {(selected || (creating && props.features?.create)) && (
            <button className="secondary back" onClick={back}>
              ← All markets
            </button>
          )}
          {creating && props.features?.create ? (
            <SoothCreateMarket
              node={resolved}
              wallet={props.wallet}
              onCancel={back}
              onWalletUnavailable={props.onCreationWalletUnavailable}
              onEvent={props.onEvent}
              onCreated={(address) => {
                setCreated(factoryAddress(address));
                setSelected(factoryAddress(address));
                setCreating(false);
                setRequestedVenue('amm');
              }}
            />
          ) : selected ? (
            <>
              {market ? (
                <>
                  {props.features?.clob && (
                    <div className="tabs venue" aria-label="Trading venue">
                      <button
                        className="secondary"
                        aria-pressed={venue === 'amm'}
                        onClick={() => setRequestedVenue('amm')}
                      >
                        AMM
                      </button>
                      <button
                        className="secondary"
                        aria-pressed={venue === 'book'}
                        onClick={() => setRequestedVenue('book')}
                      >
                        Order book
                      </button>
                    </div>
                  )}
                  <SoothMarket
                    market={market}
                    runtime={scopedRuntime}
                    wallet={props.wallet}
                    theme={props.theme}
                    appearance={props.appearance}
                    onEvent={props.onEvent}
                    initialIntent={
                      props.initialMarket?.toLowerCase() === market.market.toLowerCase()
                        ? props.initialIntent
                        : undefined
                    }
                    onWalletUnavailable={(intent) => props.onWalletUnavailable?.(intent, market)}
                  />
                </>
              ) : (
                <div className="empty" role="status">
                  <h3>{created ? 'Your market is created' : 'Market unavailable in this node'}</h3>
                  <p>
                    {created
                      ? 'The transaction is confirmed. Waiting for the catalog to index your market; it will open here automatically.'
                      : 'This address is not in the configured node catalog. Browse the available markets or refresh the catalog.'}
                  </p>
                  <p className="address">{selected}</p>
                  <button className="secondary" onClick={() => setAttempt((value) => value + 1)}>
                    Refresh catalog
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="toolbar">
                <div className="search">
                  <label htmlFor={`${id}-search`}>Find a market</label>
                  <input
                    id={`${id}-search`}
                    type="search"
                    placeholder="Search questions"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>
                {props.features?.create && (
                  <button onClick={() => setCreating(true)}>Create market</button>
                )}
              </div>
              <div className="tabs" aria-label="Market status">
                {(['open', 'resolved', 'all'] as const).map((value) => (
                  <button
                    key={value}
                    className="secondary"
                    aria-pressed={filter === value}
                    onClick={() => setFilter(value)}
                  >
                    {value === 'open' ? 'Open' : value === 'resolved' ? 'Resolved' : 'All'}
                  </button>
                ))}
              </div>
              {visible.length ? (
                <ul className="cards">
                  {visible.map((item) => {
                    const question = parseSQFSafe(item.question).question || item.question;
                    const settled = item.state.phase === 'settled';
                    const outcome =
                      settled && item.state.outcome !== null
                        ? item.state.outcome === 1
                          ? 'YES won'
                          : item.state.outcome === 0
                            ? 'NO won'
                            : 'Invalid result'
                        : null;
                    const deadline = Number(item.deadline) * 1_000;
                    return (
                      <li key={item.key}>
                        <button
                          className="card"
                          onClick={() => {
                            setSelected(item.address);
                            setRequestedVenue(soothNodeVenue(props.features, props.initialVenue));
                          }}
                        >
                          <span className="status">
                            {settled
                              ? 'Resolved'
                              : item.tradingOpen
                                ? 'Open'
                                : item.state.phase === 'live'
                                  ? 'Closed'
                                  : 'Resolving'}
                          </span>
                          <h3>{question}</h3>
                          <div className={outcome ? 'outcome' : 'muted'}>
                            {outcome || 'Open market to see live probability'}
                          </div>
                          <div className="meta">
                            <span title={item.tokenA}>
                              Collateral {item.tokenA.slice(0, 6)}…{item.tokenA.slice(-4)}
                            </span>
                            {Number.isFinite(deadline) && deadline > 0 && (
                              <span>{new Date(deadline).toLocaleDateString()}</span>
                            )}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="empty">
                  <h3>
                    {query
                      ? 'No matching markets'
                      : filter === 'resolved'
                        ? 'No resolved markets yet'
                        : filter === 'open'
                          ? 'No open markets right now'
                          : 'No markets yet'}
                  </h3>
                  <p>
                    {query
                      ? 'Try another question or clear your search.'
                      : filter !== 'all'
                        ? 'Choose All to browse the full catalog.'
                        : props.features?.create
                          ? 'Create the first market for this node.'
                          : 'Markets will appear here when they are listed.'}
                  </p>
                  {query && (
                    <button className="secondary" onClick={() => setQuery('')}>
                      Clear search
                    </button>
                  )}
                </div>
              )}
              <p className="muted provenance">
                Catalog snapshot
                {catalog?.indexed ? ` · block ${catalog.indexed.blockNumber.toLocaleString()}` : ''}
                {catalog?.facts.source === 'last-known-good' ? ' · last available data' : ''}.
                Prices and trading availability are verified live when you open a market.
              </p>
            </>
          )}
        </>
      )}
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
