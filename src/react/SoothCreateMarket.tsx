import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { formatUnits, type Address } from 'viem';
import { parseZkTlsSpecification } from '../factory/creationTerms.js';
import type { SoothResolvedNode } from './runtime.js';
import type { SoothHostEvent } from './embed.js';
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

export interface SoothCreateMarketProps {
  node: SoothResolvedNode;
  wallet?: SoothWalletAdapter;
  onCreated: (market: Address) => void;
  onCancel: () => void;
  onWalletUnavailable?: () => void;
  onEvent?: (event: SoothHostEvent) => void;
}
const field: CSSProperties = { display: 'grid', gap: 6, minWidth: 0 };
const control: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  border: '1px solid #94a3b8',
  borderRadius: 8,
  font: 'inherit',
  color: 'inherit',
  background: 'transparent',
};
const button: CSSProperties = {
  padding: '11px 16px',
  border: '1px solid #94a3b8',
  borderRadius: 8,
  font: 'inherit',
  cursor: 'pointer',
};
const kindLabels: Record<string, string> = {
  manual: 'Manual resolution',
  imd: 'IMD evidence review',
  'imd-testnet': 'IMD testnet evidence review',
  zktls: 'zkTLS website attestation',
};

/** A node-scoped flow; no existing market identity or automatic wallet handoff is required. */
export function SoothCreateMarket({
  node,
  wallet: suppliedWallet,
  onCreated,
  onCancel,
  onWalletUnavailable,
  onEvent,
}: SoothCreateMarketProps) {
  const { adapter: wallet } = useSoothWallet(suppliedWallet);
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
        setError(cause instanceof Error ? cause.message : 'Unable to read creation permissions.');
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
              if (result.status === 'failed')
                setError(
                  'The transaction reverted. Review the current configuration before trying again.',
                );
              else if (result.market) {
                setNotice(`Market created: ${result.market}. Waiting for catalog availability.`);
                try {
                  callbacks.current.onCreated(result.market);
                } catch {
                  /* The receipt remains authoritative. */
                }
              } else
                setNotice(
                  'Approval confirmed. Review the updated creation before signing the next action.',
                );
            }
          } catch (cause) {
            if (active)
              setError(
                cause instanceof Error
                  ? cause.message
                  : 'Receipt verification is unavailable. Your transaction remains saved.',
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
        setError(cause instanceof Error ? cause.message : 'Creation could not continue.');
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
      if (!selected) throw new Error('Choose an admitted resolution profile.');
      const timestamp = Date.parse(`${deadline}:00Z`);
      if (!Number.isFinite(timestamp)) throw new Error('Choose a valid UTC deadline.');
      let resolution: SoothCreationIntent['resolution'];
      if (selected.binding.kind === 'manual') resolution = { kind: 'manual' };
      else if (selected.binding.kind === 'imd' || selected.binding.kind === 'imd-testnet') {
        if (![sourceChainId, fromBlock, toBlock].every((value) => /^\d+$/.test(value)))
          throw new Error(
            'Enter the evidence source chain and inclusive block range as whole numbers.',
          );
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
          throw new Error('The creation view or wallet changed. Reopen and review before signing.');
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
                ? 'Transaction submitted. Waiting for its verified receipt.'
                : `Recovery storage is unavailable. Keep this page open and save transaction ${record.hash}.`,
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
  return (
    <section aria-labelledby={`${id}-title`} style={{ display: 'grid', gap: 18, minWidth: 0 }}>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}
      >
        <h2 id={`${id}-title`} style={{ margin: 0 }}>
          Create a market
        </h2>
        <button type="button" style={button} disabled={busy} onClick={onCancel}>
          Back to markets
        </button>
      </div>
      <p style={{ margin: 0 }}>
        Set the question, resolution rules and initial AMM liquidity. Creation registers both
        trading venues on this node.
      </p>
      {error && (
        <p role="alert" style={{ margin: 0 }}>
          {error}
        </p>
      )}
      {notice && (
        <p role="status" style={{ margin: 0, overflowWrap: 'anywhere' }}>
          {notice}
        </p>
      )}
      {pending.length > 0 && (
        <div aria-label="Pending creation transactions" style={{ display: 'grid', gap: 8 }}>
          {pending.map((record) => (
            <p key={record.hash} style={{ margin: 0, overflowWrap: 'anywhere' }}>
              {record.kind === 'createMarket' ? 'Market creation' : 'Collateral approval'} awaiting
              receipt: <code>{record.hash}</code>
              <br />
              Account: {record.account}
            </p>
          ))}
        </div>
      )}
      {!session ? (
        <button
          type="button"
          style={button}
          disabled={busy}
          onClick={() => {
            if (!wallet) {
              onWalletUnavailable?.();
              if (!onWalletUnavailable)
                setError('Connect a wallet through the host application to create a market.');
              return;
            }
            void run(async () => {
              await wallet.connect();
              setRefresh((n) => n + 1);
            });
          }}
        >
          Connect wallet to create
        </button>
      ) : session.chainId !== node.reference.chainId ? (
        <button
          type="button"
          style={button}
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await wallet!.switchChain(node.reference.chainId);
              setRefresh((n) => n + 1);
            })
          }
        >
          Switch to chain {node.reference.chainId}
        </button>
      ) : null}
      {loading && <p role="status">Checking node permissions and supported resolution profiles…</p>}
      {!loading && options?.paused && <p>Market creation is paused by this node.</p>}
      {!loading && session && !options?.walletMayCreate && !options?.paused && (
        <p>This account is not allowed to create markets on this node.</p>
      )}
      {options && (
        <form
          onSubmit={(event) => void review(event)}
          style={{ display: 'grid', gap: 16 }}
          onChange={changed}
        >
          <fieldset
            disabled={locked}
            style={{ display: 'grid', gap: 16, border: 0, margin: 0, padding: 0, minWidth: 0 }}
          >
            <label style={field}>
              Question
              <input
                aria-label="Market question"
                required
                minLength={10}
                maxLength={1000}
                style={control}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
              />
            </label>
            <label style={field}>
              Resolution rules
              <textarea
                aria-label="Resolution rules"
                required
                rows={4}
                maxLength={18000}
                style={control}
                value={rules}
                onChange={(event) => setRules(event.target.value)}
              />
            </label>
            <small>
              Explain exactly what YES, NO and INVALID mean, which evidence counts, and when the
              outcome can be determined.
            </small>
            <label style={field}>
              Trading deadline (UTC)
              <input
                aria-label="Trading deadline (UTC)"
                type="datetime-local"
                required
                style={control}
                value={deadline}
                onChange={(event) => setDeadline(event.target.value)}
              />
            </label>
            <label style={field}>
              Collateral
              <select
                aria-label="Creation collateral"
                required
                style={control}
                value={token}
                onChange={(event) => setToken(event.target.value)}
              >
                {options.tokens.map((item) => (
                  <option key={item.address} value={item.address}>
                    {item.symbol} · {item.address}
                  </option>
                ))}
              </select>
            </label>
            <label style={field}>
              Resolution profile
              <select
                aria-label="Resolution profile"
                required
                style={control}
                value={adjudicator}
                onChange={(event) => setAdjudicator(event.target.value)}
              >
                {options.profiles.map((item) => (
                  <option key={item.binding.address} value={item.binding.address}>
                    {kindLabels[item.binding.kind]} · {item.binding.address}
                  </option>
                ))}
              </select>
            </label>
            <label style={field}>
              Approved resolver
              <select
                aria-label="Approved resolver"
                required
                style={control}
                value={resolver}
                onChange={(event) => setResolver(event.target.value)}
              >
                {selected?.resolvers.map((address) => (
                  <option key={address} value={address}>
                    {address}
                  </option>
                ))}
              </select>
            </label>
            {selected && (
              <small>
                Resolution challenge period: {selected.vetoPeriod} seconds.{' '}
                {selected.earlyResolution
                  ? 'This profile permits resolution before the trading deadline.'
                  : 'This profile does not permit early resolution.'}
              </small>
            )}
            {(selected?.binding.kind === 'imd' || selected?.binding.kind === 'imd-testnet') && (
              <div style={{ display: 'grid', gap: 12 }}>
                <p style={{ margin: 0 }}>
                  IMD commits to the question, rules and evidence source block range. Certificates
                  must use the selected profile’s verified certificate domain.
                </p>
                <label style={field}>
                  Evidence source chain ID
                  <input
                    aria-label="Evidence source chain ID"
                    required
                    inputMode="numeric"
                    style={control}
                    value={sourceChainId}
                    onChange={(event) => setSourceChainId(event.target.value)}
                  />
                </label>
                <label style={field}>
                  Evidence from block
                  <input
                    aria-label="Evidence from block"
                    required
                    inputMode="numeric"
                    style={control}
                    value={fromBlock}
                    onChange={(event) => setFromBlock(event.target.value)}
                  />
                </label>
                <label style={field}>
                  Evidence through block
                  <input
                    aria-label="Evidence through block"
                    required
                    inputMode="numeric"
                    style={control}
                    value={toBlock}
                    onChange={(event) => setToBlock(event.target.value)}
                  />
                </label>
              </div>
            )}
            {selected?.binding.kind === 'zktls' && (
              <div style={{ display: 'grid', gap: 12 }}>
                <label style={field}>
                  zkTLS request and extraction specification (JSON)
                  <textarea
                    aria-label="zkTLS specification"
                    required
                    rows={8}
                    style={control}
                    value={specification}
                    onChange={(event) => setSpecification(event.target.value)}
                  />
                </label>
                <small>
                  Supply request (url, header, method, body), responseResolve entries (keyName,
                  parseType, parsePath), and attConditions. Headers and conditions are JSON strings.
                  These terms are public; omit secrets.
                </small>
                <label style={field}>
                  Attestation window after deadline (seconds)
                  <input
                    aria-label="Attestation window"
                    type="number"
                    min={1}
                    max={3600}
                    required
                    style={control}
                    value={maxAge}
                    onChange={(event) => setMaxAge(event.target.value)}
                  />
                </label>
              </div>
            )}
            <label style={field}>
              Liquidity depth
              <input
                aria-label="Liquidity depth"
                required
                inputMode="decimal"
                style={control}
                value={liquidity}
                onChange={(event) => setLiquidity(event.target.value)}
              />
            </label>
            <small>
              Depth is measured in collateral token units and controls how quickly AMM prices move.
              It is not the deposit amount. Minimum depth is 0.1.
            </small>
            <label style={field}>
              Maximum initial collateral budget
              <input
                aria-label="Maximum initial collateral budget"
                required
                inputMode="decimal"
                style={control}
                value={budget}
                onChange={(event) => setBudget(event.target.value)}
              />
            </label>
            <small>
              The protocol calculates the actual initial funding. Creation fails if it exceeds this
              cap; unused budget stays in your wallet. Gas is additional.
            </small>
            <label style={field}>
              Initial YES probability (%)
              <input
                aria-label="Initial YES probability (%)"
                required
                inputMode="decimal"
                style={control}
                value={probability}
                onChange={(event) => setProbability(event.target.value)}
              />
            </label>
          </fieldset>
          <button
            type="submit"
            style={button}
            disabled={
              locked ||
              !session ||
              session.chainId !== node.reference.chainId ||
              !options.walletMayCreate ||
              !selected ||
              !token
            }
          >
            {busy ? 'Checking…' : 'Review creation'}
          </button>
        </form>
      )}
      {options && options.unavailable.length > 0 && (
        <details>
          <summary>Unavailable creation options ({options.unavailable.length})</summary>
          {options.unavailable.map((item) => (
            <p key={item.address} style={{ overflowWrap: 'anywhere' }}>
              {item.address}: {item.reason}
            </p>
          ))}
        </details>
      )}
      {preview && (
        <section
          aria-label="Creation review"
          style={{
            display: 'grid',
            gap: 12,
            padding: 16,
            border: '1px solid #94a3b8',
            borderRadius: 12,
          }}
        >
          <h3 style={{ margin: 0 }}>Review market creation</h3>
          <p style={{ margin: 0 }}>{preview.intent.question}</p>
          <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{preview.intent.rules}</p>
          <dl
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
              gap: 8,
              margin: 0,
            }}
          >
            <dt>Maximum initial funding</dt>
            <dd style={{ margin: 0 }}>
              {formatUnits(preview.params.maxInputNative, preview.token.decimals)}{' '}
              {preview.token.symbol}
            </dd>
            <dt>Initial YES probability</dt>
            <dd style={{ margin: 0 }}>{preview.intent.probability}%</dd>
            <dt>Liquidity depth</dt>
            <dd style={{ margin: 0 }}>
              {preview.intent.liquidity} {preview.token.symbol}
            </dd>
            <dt>AMM trading fee</dt>
            <dd style={{ margin: 0 }}>{preview.ammConfig.feeBps / 100}%</dd>
            <dt>Order book trading fee</dt>
            <dd style={{ margin: 0 }}>{preview.bookConfig.feeBps / 100}%</dd>
            <dt>Trading deadline</dt>
            <dd style={{ margin: 0 }}>
              {new Date(Number(preview.params.deadline) * 1000).toISOString()}
            </dd>
            <dt>Review expires</dt>
            <dd style={{ margin: 0 }}>
              {new Date(Number(preview.params.quoteDeadline) * 1000).toISOString()}
            </dd>
          </dl>
          <p style={{ margin: 0 }}>
            {preview.approveNative === null
              ? 'The exact creation call has been simulated successfully. Confirm to fund and create this market.'
              : preview.approveNative === 0n
                ? 'Reset the existing insufficient allowance to zero first. You will review again after confirmation.'
                : `Approve only ${formatUnits(preview.approveNative, preview.token.decimals)} ${preview.token.symbol}. After confirmation, review the simulated creation and sign it separately.`}
          </p>
          <details>
            <summary>Committed profile and fee details</summary>
            <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 12 }}>
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
                (_key, value: unknown) => (typeof value === 'bigint' ? value.toString() : value),
                2,
              )}
            </pre>
          </details>
          <button type="button" style={button} disabled={locked} onClick={() => void submit()}>
            {busy
              ? 'Waiting for wallet…'
              : preview.approveNative === null
                ? 'Confirm market creation'
                : preview.approveNative === 0n
                  ? 'Reset collateral allowance'
                  : 'Approve collateral budget'}
          </button>
        </section>
      )}
    </section>
  );
}
