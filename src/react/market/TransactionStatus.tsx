import type { SoothTransactionRecoveryState } from '../hooks.js';
import type { SoothStrings } from '../ui/i18n.js';
import { Disclosure, Notice } from '../ui/primitives.js';

export interface TransactionStatusProps {
  strings: SoothStrings;
  recovery: SoothTransactionRecoveryState;
  error: string | null;
  storageWarning: boolean;
}

/** Errors, pending-record recovery and confirmed receipt events for this market view. */
export function TransactionStatus({
  strings,
  recovery,
  error,
  storageWarning,
}: TransactionStatusProps) {
  const { t } = strings;
  const active = Boolean(recovery.result || recovery.pending.length || storageWarning);
  return (
    <>
      {error && <Notice tone="error">{error}</Notice>}
      <section
        className={active ? 's-stack' : undefined}
        aria-live="polite"
        aria-label={t('tx.status')}
      >
        {recovery.result && <p role="status">{recovery.result}</p>}
        {recovery.pending.map((item) => (
          <div className="s-card s-card-flat" key={item.hash}>
            <p>{t('tx.pendingLabel', { label: item.label })}</p>
            <span className="s-small s-muted">{t('tx.autoCheck')}</span>
            <Disclosure summary={t('tx.details')} defaultOpen={storageWarning}>
              <p className="s-small">
                {t('common.wallet')}: <code>{item.account}</code>
              </p>
              <p className="s-small">
                {t('tx.hash')}: <code>{item.hash}</code>
              </p>
            </Disclosure>
          </div>
        ))}
        {storageWarning && <Notice tone="warn">{t('tx.storageBlocked')}</Notice>}
      </section>
      {recovery.events.length > 0 && (
        <div className="s-card">
          <Disclosure summary={t('market.confirmedEvents')}>
            <p className="s-small s-muted">{t('market.eventsNote')}</p>
            <ul className="s-list">
              {recovery.events.map((event) => (
                <li key={`${event.address}:${event.logIndex}`}>
                  <strong>{event.eventName}</strong>
                  <pre className="s-pre-code">
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
          </Disclosure>
        </div>
      )}
    </>
  );
}
