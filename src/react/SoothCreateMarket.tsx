import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { formatUnits, type Address } from 'viem';
import { parseZkTlsSpecification } from '../factory/creationTerms.js';
import { generateSQF } from '../lib/sqf.js';
import type { SoothResolvedNode } from './runtime.js';
import type { SoothHostEvent, SoothTheme } from './embed.js';
import { formatSoothNodeReference } from './node.js';
import type { SoothWalletAdapter, SoothWalletSession } from './wallet.js';
import { useSoothWallet } from './hooks.js';
import {
  planSoothCreation,
  readSoothCreationOptions,
  sendSoothCreation,
  type SoothCreationIntent,
  type SoothCreationOptions,
  type SoothCreationPreview,
} from './creation.js';
import {
  loadSoothPendingCreations,
  reconcileSoothCreation,
  removeSoothPendingCreation,
  type SoothPendingCreation,
} from './creationRecovery.js';
import { soothText, type SoothLocale, type SoothStringKey } from './ui/i18n.js';
import { soothBaseCss, soothRootStyle, type SoothAppearanceInput } from './ui/theme.js';
import { formatBps, formatDeadline } from './ui/format.js';
import { Disclosure, Notice } from './ui/primitives.js';

export interface SoothCreateMarketProps {
  node: SoothResolvedNode;
  wallet?: SoothWalletAdapter;
  onCreated: (market: Address) => void;
  onCancel: () => void;
  onWalletUnavailable?: () => void;
  onEvent?: (event: SoothHostEvent) => void;
  theme?: SoothTheme;
  appearance?: SoothAppearanceInput;
  locale?: SoothLocale;
}

const kindLabels: Readonly<Record<string, SoothStringKey>> = {
  manual: 'market.manualResolution',
  imd: 'market.imdReview',
  'imd-testnet': 'market.imdTestnetReview',
  zktls: 'create.zktls',
};

const styles = `${soothBaseCss}
:host { display: block; min-width: 0; }
.s-create { display: flex; flex-direction: column; gap: 12px; min-width: 0; overflow-wrap: anywhere; }
.s-create fieldset { display: flex; flex-direction: column; gap: 16px; min-width: 0; margin: 0; padding: 0; border: 0; }
.s-create dl, .s-create dd { margin: 0; }
.s-create pre { margin: 0; padding: 10px 12px; border-radius: var(--s-radius-sm); background: var(--s-surface-2); font: 12px/1.5 var(--s-mono); white-space: pre-wrap; overflow-wrap: anywhere; }
.s-create-group { display: flex; flex-direction: column; gap: 12px; }
.s-create-group + .s-create-group { padding-top: 16px; border-top: 1px solid var(--s-line); }
.s-create-row { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; }
@container sooth (min-width: 560px) { .s-create-row { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.s-create-question { font-size: 16px; font-weight: 600; }
.s-create-rules { white-space: pre-wrap; font-size: 13px; color: var(--s-muted); }
.s-create-placeholder { color: var(--s-faint); font-weight: 400; }
.s-create-risks > li { display: flex; flex-direction: column; gap: 2px; font-size: 13px; }
.s-create-pending code { font-family: var(--s-mono); font-size: 12px; }
`;

/** A node-scoped flow; no existing market identity or automatic wallet handoff is required. */
export function SoothCreateMarket(props: SoothCreateMarketProps) {
  const container = useRef<HTMLDivElement>(null);
  const [root, setRoot] = useState<ShadowRoot | null>(null);
  useEffect(() => {
    if (container.current)
      setRoot(container.current.shadowRoot ?? container.current.attachShadow({ mode: 'open' }));
  }, []);
  return (
    <div ref={container} data-sooth-create="v1">
      {root &&
        createPortal(
          <>
            <style>{styles}</style>
            <div
              className="sooth-root"
              data-theme={props.theme ?? 'auto'}
              style={soothRootStyle(props.appearance)}
            >
              <CreateMarketFlow {...props} />
            </div>
          </>,
          root,
        )}
    </div>
  );
}

function CreateMarketFlow({
  node,
  wallet: suppliedWallet,
  onCreated,
  onCancel,
  onWalletUnavailable,
  onEvent,
  locale,
}: SoothCreateMarketProps) {
  const { adapter: wallet } = useSoothWallet(suppliedWallet);
  const strings = useMemo(() => soothText(locale), [locale]);
  const { t } = strings;
  const text = useRef(strings);
  text.current = strings;
  const id = useId();
  const reference = formatSoothNodeReference(node.reference);
  const [session, setSession] = useState<SoothWalletSession | null>(null);
  const [options, setOptions] = useState<SoothCreationOptions | null>(null);
  const [question, setQuestion] = useState('');
  const [rules, setRules] = useState('');
  const [deadline, setDeadline] = useState(() =>
    new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 16),
  );
  const [token, setToken] = useState('');
  const [adjudicator, setAdjudicator] = useState('');
  const [resolver, setResolver] = useState('');
  const [liquidity, setLiquidity] = useState('100');
  const [budget, setBudget] = useState('100');
  const [probability, setProbability] = useState('50');
  const [sourceChainId, setSourceChainId] = useState('');
  const [fromBlock, setFromBlock] = useState('');
  const [toBlock, setToBlock] = useState('');
  const [specification, setSpecification] = useState('');
  const [maxAge, setMaxAge] = useState('300');
  const [preview, setPreview] = useState<SoothCreationPreview | null>(null);
  const [pending, setPending] = useState<SoothPendingCreation[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const busyRef = useRef(false);
  const epoch = useRef(0);
  const revision = useRef(0);
  const mounted = useRef(true);
  const completed = useRef(new Set<string>());
  const callbacks = useRef({ onCreated, onEvent });
  callbacks.current = { onCreated, onEvent };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      epoch.current++;
    };
  }, []);
  useEffect(() => {
    const generation = ++epoch.current;
    setLoading(true);
    setOptions(null);
    setPreview(null);
    setError(null);
    const update = async () => {
      try {
        const current = (await wallet?.getSession()) ?? null;
        const next = await readSoothCreationOptions(node, current?.account);
        if (!mounted.current || generation !== epoch.current) return;
        setSession(current);
        setOptions(next);
        setToken((value) =>
          next.tokens.some((t) => t.address === value) ? value : (next.tokens[0]?.address ?? ''),
        );
        setAdjudicator((value) =>
          next.profiles.some((p) => p.binding.address === value)
            ? value
            : ((next.profiles.find((p) => p.binding.kind === 'manual') ?? next.profiles[0])?.binding
                .address ?? ''),
        );
        setLoading(false);
      } catch (cause) {
        if (!mounted.current || generation !== epoch.current) return;
        setError(
          cause instanceof Error ? cause.message : text.current.t('create.permissionsFailed'),
        );
        setLoading(false);
      }
    };
    void update();
    const unsubscribe = wallet?.subscribe?.(() => {
      revision.current++;
      setPreview(null);
      setRefresh((n) => n + 1);
    });
    return () => {
      epoch.current++;
      unsubscribe?.();
    };
  }, [reference, node, wallet, refresh]);
  const selected = options?.profiles.find((p) => p.binding.address === adjudicator);
  useEffect(() => {
    setResolver((value) =>
      selected?.resolvers.includes(value as Address) ? value : (selected?.resolvers[0] ?? ''),
    );
    setPreview(null);
  }, [selected?.binding.address]);
  useEffect(() => {
    let active = true,
      running = false;
    const sync = async () => {
      if (running) return;
      running = true;
      try {
        const records = loadSoothPendingCreations(reference);
        if (active) setPending(records);
        for (const record of records) {
          if (!active) break;
          try {
            const result = await reconcileSoothCreation(node, record);
            if (!active || result.status === 'pending') continue;
            removeSoothPendingCreation(reference, record.hash);
            if (!completed.current.has(record.hash)) {
              completed.current.add(record.hash);
              try {
                callbacks.current.onEvent?.({
                  type:
                    result.status === 'confirmed' ? 'transaction-confirmed' : 'transaction-failed',
                  hash: record.hash,
                  chainId: record.chainId,
                });
              } catch {
                /* Host callbacks cannot undo receipts. */
              }
              setPreview(null);
              setRefresh((n) => n + 1);
              if (result.status === 'failed') setError(text.current.t('tx.reverted'));
              else if (result.market) {
                setNotice(text.current.t('create.created', { market: result.market }));
                try {
                  callbacks.current.onCreated(result.market);
                } catch {
                  /* The receipt remains authoritative. */
                }
              } else setNotice(text.current.t('create.approvalConfirmed'));
            }
          } catch (cause) {
            if (active)
              setError(
                cause instanceof Error ? cause.message : text.current.t('tx.receiptUnavailable'),
              );
          }
        }
        if (active) setPending(loadSoothPendingCreations(reference));
      } finally {
        running = false;
      }
    };
    void sync();
    const timer = setInterval(() => void sync(), 4_000);
    const storageChanged = () => void sync();
    window.addEventListener('storage', storageChanged);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('storage', storageChanged);
    };
  }, [reference, node]);
  const accountPending = pending.some(
    (p) => p.account.toLowerCase() === session?.account.toLowerCase(),
  );
  const locked = busy || accountPending;
  const changed = () => {
    revision.current++;
    setPreview(null);
    setNotice(null);
  };
  async function run(action: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      if (mounted.current)
        setError(cause instanceof Error ? cause.message : text.current.t('create.failed'));
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function review(event: FormEvent) {
    event.preventDefault();
    if (!session || locked) return;
    const generation = epoch.current,
      draftRevision = revision.current;
    await run(async () => {
      if (!selected) throw new Error(text.current.t('create.chooseProfile'));
      const timestamp = Date.parse(`${deadline}:00Z`);
      if (!Number.isFinite(timestamp)) throw new Error(text.current.t('create.invalidDeadline'));
      let resolution: SoothCreationIntent['resolution'];
      if (selected.binding.kind === 'manual') resolution = { kind: 'manual' };
      else if (selected.binding.kind === 'imd' || selected.binding.kind === 'imd-testnet') {
        if (![sourceChainId, fromBlock, toBlock].every((value) => /^\d+$/.test(value)))
          throw new Error(text.current.t('create.evidenceInvalid'));
        resolution = {
          kind: 'imd',
          context: {
            sourceChainId: Number(sourceChainId),
            fromBlock: Number(fromBlock),
            toBlock: Number(toBlock),
          },
        };
      } else resolution = parseZkTlsSpecification(specification, Number(maxAge));
      const result = await planSoothCreation(node, session.account, {
        question,
        rules,
        deadline: BigInt(Math.floor(timestamp / 1000)),
        token: token as Address,
        adjudicator: adjudicator as Address,
        resolver: resolver as Address,
        liquidity,
        budget,
        probability,
        resolution,
      });
      if (mounted.current && generation === epoch.current && draftRevision === revision.current)
        setPreview(result);
    });
  }
  async function submit() {
    if (!wallet || !preview || locked) return;
    const current = preview;
    const generation = epoch.current,
      draftRevision = revision.current;
    const guardedWallet: SoothWalletAdapter = {
      connect: () => wallet.connect(),
      getSession: () => wallet.getSession(),
      switchChain: (chainId) => wallet.switchChain(chainId),
      sendTransaction: (request) => {
        if (!mounted.current || generation !== epoch.current || draftRevision !== revision.current)
          throw new Error(text.current.t('create.viewChanged'));
        return wallet.sendTransaction(request);
      },
    };
    await run(async () => {
      await sendSoothCreation(
        node,
        guardedWallet,
        current,
        current.approveNative === null ? 'createMarket' : 'approveCreation',
        (record) => {
          if (mounted.current) {
            setPreview(null);
            setPending(loadSoothPendingCreations(reference));
            setNotice(
              record.storageAvailable
                ? text.current.t('tx.submitted')
                : text.current.t('tx.storageUnavailable', { hash: record.hash }),
            );
          }
          try {
            callbacks.current.onEvent?.({
              type: 'transaction-submitted',
              hash: record.hash,
              chainId: record.chainId,
            });
          } catch {
            /* Recorded transaction remains recoverable. */
          }
        },
      );
    });
  }

  // Display-only: the same SQF encoding planSoothCreation commits, so the creator sees the terms.
  const terms = generateSQF({ question: question.trim(), rule: { description: rules.trim() } });
  const sectionMarkers = /(?:^|\n)§/.test(question) || /(?:^|\n)§/.test(rules);
  const deadlineSeconds = Date.parse(`${deadline}:00Z`) / 1000;
  const yesPercent = Number(probability);
  const odds =
    probability.trim() !== '' && yesPercent > 0 && yesPercent < 100
      ? t('create.oddsValue', { yes: yesPercent, no: Number((100 - yesPercent).toFixed(4)) })
      : '—';
  const tokenSymbol = options?.tokens.find((item) => item.address === token)?.symbol ?? '';
  const field = (name: string) => `${id}-${name}`;
  const kindLabel = (kind: string) => {
    const key = kindLabels[kind];
    return key ? t(key) : kind;
  };

  return (
    <section className="s-create" aria-labelledby={field('title')}>
      <header className="s-between">
        <div className="s-stack" style={{ gap: 2 }}>
          <span className="s-label">{t('create.section')}</span>
          <h1 id={field('title')}>{t('create.heading')}</h1>
        </div>
        <button
          type="button"
          className="s-btn s-btn-ghost s-btn-sm"
          disabled={busy}
          onClick={onCancel}
        >
          {t('create.backToMarkets')}
        </button>
      </header>
      <p className="s-muted">{t('create.intro')}</p>
      {error && (
        <Notice tone="error">
          <p>{error}</p>
        </Notice>
      )}
      {notice && (
        <Notice>
          <p>{notice}</p>
        </Notice>
      )}
      {pending.length > 0 && (
        <div
          role="group"
          aria-label={t('create.pendingTitle')}
          className="s-card s-card-flat s-create-pending"
        >
          <span className="s-card-title">{t('create.pendingTitle')}</span>
          {pending.map((record) => (
            <p key={record.hash} className="s-small">
              {t('create.awaitingReceipt', {
                kind:
                  record.kind === 'createMarket'
                    ? t('create.kindCreate')
                    : t('create.kindApproval'),
              })}
              : <code>{record.hash}</code>
              <br />
              {t('create.account')}: <code>{record.account}</code>
            </p>
          ))}
        </div>
      )}
      {!session ? (
        <button
          type="button"
          className="s-btn s-btn-primary s-btn-block"
          disabled={busy}
          onClick={() => {
            if (!wallet) {
              onWalletUnavailable?.();
              if (!onWalletUnavailable) setError(t('wallet.connectToCreate'));
              return;
            }
            void run(async () => {
              await wallet.connect();
              setRefresh((n) => n + 1);
            });
          }}
        >
          {t('create.connect')}
        </button>
      ) : session.chainId !== node.reference.chainId ? (
        <button
          type="button"
          className="s-btn s-btn-primary s-btn-block"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await wallet!.switchChain(node.reference.chainId);
              setRefresh((n) => n + 1);
            })
          }
        >
          {t('create.switchChain', { chainId: node.reference.chainId })}
        </button>
      ) : null}
      {loading && (
        <Notice>
          <p>{t('create.checking')}</p>
        </Notice>
      )}
      {!loading && options?.paused && (
        <Notice tone="warn">
          <p>{t('create.paused')}</p>
        </Notice>
      )}
      {!loading && session && !options?.walletMayCreate && !options?.paused && (
        <Notice tone="warn">
          <p>{t('create.notAllowed')}</p>
        </Notice>
      )}
      <div className="s-layout">
        <div className="s-layout-main">
          {options && (
            <form className="s-card" onSubmit={(event) => void review(event)} onChange={changed}>
              <fieldset disabled={locked}>
                <div className="s-create-group">
                  <h2>{t('create.stepQuestion')}</h2>
                  <div className="s-field">
                    <label className="s-field-label" htmlFor={field('question')}>
                      {t('create.question')}
                    </label>
                    <input
                      id={field('question')}
                      className="s-input"
                      required
                      minLength={10}
                      maxLength={1000}
                      placeholder={t('create.questionPlaceholder')}
                      value={question}
                      onChange={(event) => setQuestion(event.target.value)}
                    />
                  </div>
                  <div className="s-field">
                    <label className="s-field-label" htmlFor={field('rules')}>
                      {t('create.rules')}
                    </label>
                    <textarea
                      id={field('rules')}
                      className="s-textarea"
                      required
                      rows={4}
                      maxLength={18000}
                      placeholder={t('create.rulesPlaceholder')}
                      aria-describedby={field('rules-hint')}
                      value={rules}
                      onChange={(event) => setRules(event.target.value)}
                    />
                    <span id={field('rules-hint')} className="s-field-hint">
                      {t('create.rulesHint')}
                    </span>
                  </div>
                </div>
                <div className="s-create-group">
                  <h2>{t('create.stepResolution')}</h2>
                  <div className="s-field">
                    <label className="s-field-label" htmlFor={field('deadline')}>
                      {t('create.deadline')}
                    </label>
                    <input
                      id={field('deadline')}
                      className="s-input"
                      type="datetime-local"
                      required
                      value={deadline}
                      onChange={(event) => setDeadline(event.target.value)}
                    />
                  </div>
                  <div className="s-field">
                    <label className="s-field-label" htmlFor={field('profile')}>
                      {t('create.profile')}
                    </label>
                    <select
                      id={field('profile')}
                      className="s-select"
                      required
                      aria-describedby={selected ? field('profile-hint') : undefined}
                      value={adjudicator}
                      onChange={(event) => setAdjudicator(event.target.value)}
                    >
                      {options.profiles.map((item) => (
                        <option key={item.binding.address} value={item.binding.address}>
                          {kindLabel(item.binding.kind)} · {item.binding.address}
                        </option>
                      ))}
                    </select>
                    {selected && (
                      <span id={field('profile-hint')} className="s-field-hint">
                        {t('create.challengePeriod', { seconds: selected.vetoPeriod })}{' '}
                        {selected.earlyResolution
                          ? t('market.earlyResolutionAllowed')
                          : t('market.earlyResolutionDenied')}
                      </span>
                    )}
                  </div>
                  <div className="s-field">
                    <label className="s-field-label" htmlFor={field('resolver')}>
                      {t('market.approvedResolver')}
                    </label>
                    <select
                      id={field('resolver')}
                      className="s-select"
                      required
                      value={resolver}
                      onChange={(event) => setResolver(event.target.value)}
                    >
                      {selected?.resolvers.map((address) => (
                        <option key={address} value={address}>
                          {address}
                        </option>
                      ))}
                    </select>
                  </div>
                  {(selected?.binding.kind === 'imd' ||
                    selected?.binding.kind === 'imd-testnet') && (
                    <>
                      <p className="s-field-hint">{t('create.imdNote')}</p>
                      <div className="s-field">
                        <label className="s-field-label" htmlFor={field('source-chain')}>
                          {t('create.evidenceChain')}
                        </label>
                        <input
                          id={field('source-chain')}
                          className="s-input s-input-num"
                          required
                          inputMode="numeric"
                          value={sourceChainId}
                          onChange={(event) => setSourceChainId(event.target.value)}
                        />
                      </div>
                      <div className="s-create-row">
                        <div className="s-field">
                          <label className="s-field-label" htmlFor={field('from-block')}>
                            {t('create.evidenceFrom')}
                          </label>
                          <input
                            id={field('from-block')}
                            className="s-input s-input-num"
                            required
                            inputMode="numeric"
                            value={fromBlock}
                            onChange={(event) => setFromBlock(event.target.value)}
                          />
                        </div>
                        <div className="s-field">
                          <label className="s-field-label" htmlFor={field('to-block')}>
                            {t('create.evidenceThrough')}
                          </label>
                          <input
                            id={field('to-block')}
                            className="s-input s-input-num"
                            required
                            inputMode="numeric"
                            value={toBlock}
                            onChange={(event) => setToBlock(event.target.value)}
                          />
                        </div>
                      </div>
                    </>
                  )}
                  {selected?.binding.kind === 'zktls' && (
                    <>
                      <div className="s-field">
                        <label className="s-field-label" htmlFor={field('zktls')}>
                          {t('create.zktlsSpec')}
                        </label>
                        <textarea
                          id={field('zktls')}
                          className="s-textarea s-input-num"
                          required
                          rows={8}
                          aria-describedby={field('zktls-hint')}
                          value={specification}
                          onChange={(event) => setSpecification(event.target.value)}
                        />
                        <span id={field('zktls-hint')} className="s-field-hint">
                          {t('create.zktlsHint')}
                        </span>
                      </div>
                      <div className="s-field">
                        <label className="s-field-label" htmlFor={field('max-age')}>
                          {t('create.attestationWindow')}
                        </label>
                        <input
                          id={field('max-age')}
                          className="s-input s-input-num"
                          type="number"
                          min={1}
                          max={3600}
                          required
                          value={maxAge}
                          onChange={(event) => setMaxAge(event.target.value)}
                        />
                      </div>
                    </>
                  )}
                </div>
                <div className="s-create-group">
                  <h2>{t('create.stepFunding')}</h2>
                  <div className="s-field">
                    <label className="s-field-label" htmlFor={field('token')}>
                      {t('create.creationCollateral')}
                    </label>
                    <select
                      id={field('token')}
                      className="s-select"
                      required
                      value={token}
                      onChange={(event) => setToken(event.target.value)}
                    >
                      {options.tokens.map((item) => (
                        <option key={item.address} value={item.address}>
                          {item.symbol} · {item.address}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="s-create-row">
                    <div className="s-field">
                      <label className="s-field-label" htmlFor={field('liquidity')}>
                        {t('create.liquidityDepth')}
                      </label>
                      <input
                        id={field('liquidity')}
                        className="s-input s-input-num"
                        required
                        inputMode="decimal"
                        aria-describedby={field('liquidity-hint')}
                        value={liquidity}
                        onChange={(event) => setLiquidity(event.target.value)}
                      />
                      <span id={field('liquidity-hint')} className="s-field-hint">
                        {t('create.liquidityHint')}
                      </span>
                    </div>
                    <div className="s-field">
                      <label className="s-field-label" htmlFor={field('budget')}>
                        {t('create.maxCollateral')}
                      </label>
                      <input
                        id={field('budget')}
                        className="s-input s-input-num"
                        required
                        inputMode="decimal"
                        aria-describedby={field('budget-hint')}
                        value={budget}
                        onChange={(event) => setBudget(event.target.value)}
                      />
                      <span id={field('budget-hint')} className="s-field-hint">
                        {t('create.budgetHint')}
                      </span>
                    </div>
                  </div>
                  <div className="s-field">
                    <label className="s-field-label" htmlFor={field('probability')}>
                      {t('create.initialProbability')}
                    </label>
                    <input
                      id={field('probability')}
                      className="s-input s-input-num"
                      required
                      inputMode="decimal"
                      value={probability}
                      onChange={(event) => setProbability(event.target.value)}
                    />
                  </div>
                </div>
              </fieldset>
              <button
                type="submit"
                className="s-btn s-btn-primary s-btn-block"
                disabled={
                  locked ||
                  !session ||
                  session.chainId !== node.reference.chainId ||
                  !options.walletMayCreate ||
                  !selected ||
                  !token
                }
              >
                {busy ? t('trade.checking') : t('create.review')}
              </button>
            </form>
          )}
          {options && options.unavailable.length > 0 && (
            <Disclosure
              summary={t('create.unavailableOptions', { count: options.unavailable.length })}
            >
              {options.unavailable.map((item) => (
                <p key={item.address} className="s-small s-muted">
                  {item.address}: {item.reason}
                </p>
              ))}
            </Disclosure>
          )}
          {preview && (
            <section aria-label={t('create.creationReview')} className="s-card">
              <h2>{t('create.reviewTitle')}</h2>
              <p className="s-create-question">{preview.intent.question}</p>
              <p className="s-create-rules">{preview.intent.rules}</p>
              <dl>
                <div className="s-kv">
                  <dt>{t('create.maxFunding')}</dt>
                  <dd>
                    {formatUnits(preview.params.maxInputNative, preview.token.decimals)}{' '}
                    {preview.token.symbol}
                  </dd>
                </div>
                <div className="s-kv">
                  <dt>{t('create.initialProbabilityShort')}</dt>
                  <dd>{preview.intent.probability}%</dd>
                </div>
                <div className="s-kv">
                  <dt>{t('create.liquidityDepth')}</dt>
                  <dd>
                    {preview.intent.liquidity} {preview.token.symbol}
                  </dd>
                </div>
                <div className="s-kv">
                  <dt>{t('market.ammFee')}</dt>
                  <dd>{formatBps(preview.ammConfig.feeBps)}</dd>
                </div>
                <div className="s-kv">
                  <dt>{t('market.bookFee')}</dt>
                  <dd>{formatBps(preview.bookConfig.feeBps)}</dd>
                </div>
                <div className="s-kv">
                  <dt>{t('market.tradingDeadline')}</dt>
                  <dd>{formatDeadline(preview.params.deadline, strings.locale, 'UTC')} UTC</dd>
                </div>
                <div className="s-kv">
                  <dt>{t('trade.reviewExpires')}</dt>
                  <dd>{formatDeadline(preview.params.quoteDeadline, strings.locale, 'UTC')} UTC</dd>
                </div>
              </dl>
              <p className="s-small">
                {preview.approveNative === null
                  ? t('create.simulated')
                  : preview.approveNative === 0n
                    ? t('trade.resetFirst')
                    : t('create.approveNote', {
                        amount: formatUnits(preview.approveNative, preview.token.decimals),
                        symbol: preview.token.symbol,
                      })}
              </p>
              <Disclosure summary={t('market.committedProfile')}>
                <pre>
                  {JSON.stringify(
                    {
                      account: preview.account,
                      collateral: preview.token.address,
                      resolver: preview.intent.resolver,
                      profile: preview.profile.binding,
                      resolution: preview.intent.resolution,
                      ammFees: preview.ammConfig,
                      bookFees: preview.bookConfig,
                      params: preview.params,
                    },
                    (_key, value: unknown) =>
                      typeof value === 'bigint' ? value.toString() : value,
                    2,
                  )}
                </pre>
              </Disclosure>
              <button
                type="button"
                className="s-btn s-btn-primary s-btn-block"
                disabled={locked}
                onClick={() => void submit()}
              >
                {busy
                  ? t('wallet.waiting')
                  : preview.approveNative === null
                    ? t('create.confirm')
                    : preview.approveNative === 0n
                      ? t('create.resetAllowance')
                      : t('create.approveBudget')}
              </button>
            </section>
          )}
        </div>
        <aside className="s-layout-side" aria-label={t('create.summaryTitle')}>
          <div className="s-card">
            <span className="s-card-title">{t('create.previewTitle')}</span>
            <p className={`s-create-question${question.trim() ? '' : ' s-create-placeholder'}`}>
              {question.trim() || t('create.previewQuestion')}
            </p>
            <p className={`s-create-rules${rules.trim() ? '' : ' s-create-placeholder'}`}>
              {rules.trim() || t('create.previewRules')}
            </p>
            <dl>
              <div className="s-kv">
                <dt>{t('create.openingOdds')}</dt>
                <dd>{odds}</dd>
              </div>
              <div className="s-kv">
                <dt>{t('market.tradingDeadline')}</dt>
                <dd>
                  {Number.isFinite(deadlineSeconds)
                    ? `${formatDeadline(deadlineSeconds, strings.locale, 'UTC')} UTC`
                    : '—'}
                </dd>
              </div>
            </dl>
            {sectionMarkers && (
              <Notice tone="warn">
                <p>{t('create.sectionMarkers')}</p>
              </Notice>
            )}
            <Disclosure summary={t('create.encodedTerms')}>
              <pre>{terms}</pre>
              <span className="s-small s-muted">
                {t('create.termsLength', { count: terms.length.toLocaleString() })}
              </span>
            </Disclosure>
          </div>
          <div className="s-card">
            <span className="s-card-title">{t('create.summaryTitle')}</span>
            <dl>
              <div className="s-kv">
                <dt>{t('create.maxFunding')}</dt>
                <dd>{budget.trim() ? `${budget.trim()} ${tokenSymbol}`.trim() : '—'}</dd>
              </div>
              <div className="s-kv">
                <dt>{t('create.tradingFees')}</dt>
                <dd>
                  {preview
                    ? t('create.feesValue', {
                        amm: formatBps(preview.ammConfig.feeBps),
                        book: formatBps(preview.bookConfig.feeBps),
                      })
                    : t('create.feesAtReview')}
                </dd>
              </div>
              <div className="s-kv">
                <dt>{t('create.resolution')}</dt>
                <dd>{selected ? kindLabel(selected.binding.kind) : '—'}</dd>
              </div>
              <div className="s-kv">
                <dt>{t('create.gas')}</dt>
                <dd>{t('create.gasSeparate')}</dd>
              </div>
            </dl>
            <p className="s-small s-muted">{t('create.fundingRisk')}</p>
            <ul className="s-list s-create-risks">
              <li>
                <strong>{t('create.riskVolumeTitle')}</strong>
                <span className="s-muted">{t('create.riskVolume')}</span>
              </li>
              <li>
                <strong>{t('create.riskSettlementTitle')}</strong>
                <span className="s-muted">{t('create.riskSettlement')}</span>
              </li>
              <li>
                <strong>{t('create.riskContractTitle')}</strong>
                <span className="s-muted">{t('create.riskContract')}</span>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </section>
  );
}
