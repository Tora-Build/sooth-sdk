import { useEffect, useState } from 'react';
import { formatUnits } from 'viem';
import type { SoothMarketData } from '../runtime.js';
import { shortAddress } from '../ui/format.js';
import type { SoothStrings } from '../ui/i18n.js';

const WAD = 10n ** 18n;

/** Live AMM YES probability, or null when the pool price is missing or out of range. */
export function yesProbability(data: SoothMarketData): number | null {
  const wad = data.snapshot.yesPriceWad;
  return typeof wad === 'bigint' && wad >= 0n && wad <= WAD ? Number(formatUnits(wad, 18)) : null;
}

/** Signing-relevant amounts are shown exactly, never rounded. */
export function exactToken(amount: bigint, token: { decimals: number; symbol: string }): string {
  return `${formatUnits(amount, token.decimals)} ${token.symbol}`;
}

/** Shares the account can sell now: AMM holdings, or unreserved book inventory in whole share units. */
export function sellableShares(data: SoothMarketData, outcome: 0 | 1): bigint | null {
  const account = data.account;
  if (!account) return null;
  const held = account.positions?.positions[0];
  if (held) return outcome === 1 ? held.yes : held.no;
  const inventory = account.inventory;
  if (!inventory) return null;
  const owned = outcome === 1 ? inventory.yesOwned : inventory.noOwned;
  const reserved = outcome === 1 ? inventory.yesReserved : inventory.noReserved;
  const free = owned > reserved ? owned - reserved : 0n;
  return inventory.shareUnit > 0n ? free - (free % inventory.shareUnit) : free;
}

/** Matches `sharesAmount` in trading.ts without parsing: a positive decimal with <= 18 places. */
export function validShares(value: string): boolean {
  return /^\d+(?:\.\d{1,18})?$/.test(value) && /[1-9]/.test(value);
}

/** Re-render on an interval so countdowns stay current. */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** Label/value row with a copy button; a blocked clipboard reveals the full value to select. */
export function CopyValue({
  strings,
  label,
  value,
}: {
  strings: SoothStrings;
  label: string;
  value: string;
}) {
  const { t } = strings;
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  useEffect(() => {
    if (state !== 'copied') return;
    const timer = setTimeout(() => setState('idle'), 2_000);
    return () => clearTimeout(timer);
  }, [state]);
  const copy = async () => {
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText)
        throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(value);
      setState('copied');
    } catch {
      setState('failed');
    }
  };
  return (
    <div className="s-stack s-copy-row">
      <div className="s-kv">
        <span>{label}</span>
        <span className="s-row s-copy">
          <code title={value}>{shortAddress(value)}</code>
          <button
            type="button"
            className="s-btn s-btn-ghost s-btn-sm"
            aria-label={t('market.copyLabel', { label })}
            onClick={() => void copy()}
          >
            {state === 'copied' ? t('common.copied') : t('common.copy')}
          </button>
        </span>
      </div>
      {state === 'failed' && (
        <span role="status" className="s-small s-muted">
          {t('market.copyFailed')} <code className="s-select-all">{value}</code>
        </span>
      )}
    </div>
  );
}
