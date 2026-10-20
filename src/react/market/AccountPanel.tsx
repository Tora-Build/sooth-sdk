import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { SoothLiquidity } from '../data.js';
import type { SoothDataState } from '../dataHooks.js';
import type { SoothMarketData, SoothResolvedMarket } from '../runtime.js';
import type { SoothMarketActions } from '../tradeFlow.js';
import {
  formatCents,
  formatDeadline,
  formatShares,
  formatTokenAmount,
  formatTokenWithSymbol,
  tokenAmountToNumber,
} from '../ui/format.js';
import type { SoothStrings } from '../ui/i18n.js';
import { Notice, Stat } from '../ui/primitives.js';
import { LiquidityPanel } from './LiquidityPanel.js';
import { yesProbability } from './shared.js';

type AccountTab = 'positions' | 'orders' | 'claims' | 'liquidity';

export interface AccountPanelProps {
  strings: SoothStrings;
  resolved: SoothResolvedMarket;
  data: SoothMarketData;
  actions: SoothMarketActions;
  liquidity: SoothDataState<SoothLiquidity>;
  refresh: () => void;
}

interface Claim {
  id: string;
  label: string;
  amount: string | null;
  action: string;
  run: () => Promise<void>;
}

/** Positions, open orders, claims and LP receipts as tabs; tabs that do not apply are hidden. */
export function AccountPanel({
  strings,
  resolved,
  data,
  actions,
  liquidity,
  refresh,
}: AccountPanelProps) {
  const { t, locale } = strings;
  const baseId = useId();
  const tabButtons = useRef<(HTMLButtonElement | null)[]>([]);
  const [chosen, setChosen] = useState<AccountTab | null>(null);
  const account = data.account;
  if (!account) return null;
  const { snapshot, token } = data;
  const venue = resolved.reference.venue;
  const { ready } = actions;
  const held = account.positions?.positions[0];
  const inventory = account.inventory;
  const yesHeld = held?.yes ?? inventory?.yesOwned ?? 0n;
  const noHeld = held?.no ?? inventory?.noOwned ?? 0n;
  const settleable =
    venue === 'amm'
      ? Boolean(held && (held.yes > 0n || held.no > 0n))
      : Boolean(
          inventory &&
          (inventory.yesOwned > inventory.yesReserved || inventory.noOwned > inventory.noReserved),
        );
  const { entitlements } = account;
  const claims: Claim[] = [];
  if (snapshot.settled && settleable)
    claims.push({
      id: 'settle',
      label: t('claims.settleLabel'),
      amount: null,
      action: venue === 'amm' ? t('claims.settleAmm') : t('claims.settleBook'),
      run: () => actions.settle(venue),
    });
  const floorWad = venue === 'amm' ? entitlements.floorWad : null;
  const floorClaim = floorWad !== null && floorWad > 0n;
  if (floorClaim)
    claims.push({
      id: 'floor',
      label: t('claims.floorLabel'),
      amount: `${formatTokenAmount(floorWad, 18, 4)} ${token.symbol}`,
      action: t('claims.floor'),
      run: () => actions.claim('claimFloor'),
    });
  // A timeout refund is final only after invalidation, or past the permissionless invalidation time.
  const timeoutOpen = snapshot.settled
    ? snapshot.settlementKind === 2
    : snapshot.blockTimestamp !== null &&
      snapshot.blockTimestamp >= snapshot.permissionlessInvalidationAt;
  if (
    venue === 'book' &&
    timeoutOpen &&
    entitlements.bookTimeoutRefundNative !== null &&
    entitlements.bookTimeoutRefundNative > 0n
  )
    claims.push({
      id: 'timeout',
      label: t('claims.timeoutLabel'),
      amount: formatTokenWithSymbol(
        entitlements.bookTimeoutRefundNative,
        token.decimals,
        token.symbol,
        4,
      ),
      action: t('claims.timeoutRefund'),
      run: () => actions.claim('claimTimeoutRefund'),
    });
  if (
    venue === 'book' &&
    entitlements.bookDeferredNative !== null &&
    entitlements.bookDeferredNative > 0n
  )
    claims.push({
      id: 'deferred',
      label: t('claims.deferredLabel'),
      amount: formatTokenWithSymbol(
        entitlements.bookDeferredNative,
        token.decimals,
        token.symbol,
        4,
      ),
      action: t('claims.deferred'),
      run: () => actions.claim('claimDeferred'),
    });

  const tabs: { id: AccountTab; label: string }[] = [
    { id: 'positions', label: t('account.positions') },
  ];
  if (venue === 'book' && (account.orders || account.ordersError))
    tabs.push({
      id: 'orders',
      label: account.orders
        ? `${t('account.orders')} (${account.orders.orders.length})`
        : t('account.orders'),
    });
  if (claims.length)
    tabs.push({ id: 'claims', label: `${t('account.claims')} (${claims.length})` });
  const lp = liquidity.data;
  if (lp ? lp.receipts.length > 0 || lp.claims.length > 0 || lp.liquidityOpen : liquidity.error)
    tabs.push({ id: 'liquidity', label: t('account.liquidity') });
  const fallback: AccountTab = claims.length ? 'claims' : 'positions';
  const active = chosen && tabs.some((tab) => tab.id === chosen) ? chosen : fallback;
  const activeIndex = tabs.findIndex((tab) => tab.id === active);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = tabs.length - 1;
    const next =
      event.key === 'ArrowRight'
        ? (activeIndex + 1) % tabs.length
        : event.key === 'ArrowLeft'
          ? (activeIndex - 1 + tabs.length) % tabs.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    setChosen(tabs[next]!.id);
    tabButtons.current[next]?.focus();
  };

  let panel: ReactNode;
  if (active === 'positions') {
    // Mark value: settled winners pay one token per share; open markets use the AMM price.
    const yes = snapshot.settled
      ? snapshot.outcome === 1
        ? 1
        : snapshot.outcome === 0
          ? 0
          : null
      : yesProbability(data);
    const mark =
      yes === null
        ? '—'
        : `${(tokenAmountToNumber(yesHeld, 18) * yes + tokenAmountToNumber(noHeld, 18) * (1 - yes)).toFixed(2)} ${token.symbol}`;
    panel = (
      <>
        <h3>{t('positions.title')}</h3>
        <dl className="s-stats">
          <Stat label={t('positions.yesHeld')} value={formatShares(yesHeld)} />
          <Stat label={t('positions.noHeld')} value={formatShares(noHeld)} />
          {inventory && (
            <>
              <Stat
                label={t('positions.yesFree')}
                value={formatShares(
                  inventory.yesOwned > inventory.yesReserved
                    ? inventory.yesOwned - inventory.yesReserved
                    : 0n,
                )}
              />
              <Stat
                label={t('positions.noFree')}
                value={formatShares(
                  inventory.noOwned > inventory.noReserved
                    ? inventory.noOwned - inventory.noReserved
                    : 0n,
                )}
              />
              <Stat
                label={t('positions.yesReserved')}
                value={formatShares(inventory.yesReserved)}
              />
              <Stat label={t('positions.noReserved')} value={formatShares(inventory.noReserved)} />
              <Stat
                label={t('positions.collateralReserved')}
                value={formatTokenWithSymbol(inventory.cashReserved, token.decimals, token.symbol)}
              />
            </>
          )}
          <Stat
            label={t('positions.markValue')}
            value={mark}
            hint={snapshot.settled ? undefined : t('positions.markHint')}
          />
        </dl>
        {yesHeld === 0n && noHeld === 0n && <p className="s-muted">{t('positions.empty')}</p>}
      </>
    );
  } else if (active === 'orders') {
    panel = (
      <>
        <h3>{t('orders.title')}</h3>
        {account.ordersError && (
          <Notice
            tone="error"
            action={
              <button type="button" className="s-btn s-btn-secondary s-btn-sm" onClick={refresh}>
                {t('orders.retry')}
              </button>
            }
          >
            {t('orders.incomplete', { reason: account.ordersError })}
          </Notice>
        )}
        {account.orders &&
          (account.orders.orders.length ? (
            <ul className="s-list">
              {account.orders.orders.map((order) => {
                const id = String(order.orderId);
                // Orders rest on the YES axis; a NO order's own price is the complement.
                const price = (order.outcome === 1 ? order.yesTick : 1_000 - order.yesTick) / 1_000;
                return (
                  <li key={id} className="s-between">
                    <span className="s-stack">
                      <strong>
                        {order.action === 0 ? t('common.buy') : t('common.sell')}{' '}
                        {order.outcome === 1 ? t('common.yes') : t('common.no')} ·{' '}
                        <span className="s-num">{formatCents(price)}</span>
                      </strong>
                      <span className="s-small s-muted">
                        {t('orders.remaining')}:{' '}
                        <span className="s-num">{formatShares(order.amount)}</span>
                        {' · '}
                        {t('orders.id', { id })}
                        {' · '}
                        {t('orders.expires')} {formatDeadline(order.expiry, locale)}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="s-btn s-btn-secondary s-btn-sm"
                      aria-label={t('orders.cancelNamed', { id })}
                      disabled={!ready}
                      onClick={() => void actions.cancelOrder(order.orderId)}
                    >
                      {t('orders.cancel')}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            !account.ordersError && <p className="s-muted">{t('orders.empty')}</p>
          ))}
      </>
    );
  } else if (active === 'claims') {
    panel = (
      <>
        <h3>{t('claims.title')}</h3>
        <ul className="s-list">
          {claims.map((claim) => (
            <li key={claim.id} className="s-stack">
              <div className="s-kv">
                <span>{claim.label}</span>
                <span>{claim.amount ?? ''}</span>
              </div>
              <button
                type="button"
                className="s-btn s-btn-primary s-btn-block"
                disabled={!ready}
                onClick={() => void claim.run()}
              >
                {claim.action}
              </button>
            </li>
          ))}
        </ul>
      </>
    );
  } else {
    panel = (
      <LiquidityPanel
        strings={strings}
        resolved={resolved}
        account={account.address}
        liquidity={liquidity}
        actions={actions}
        hideFloor={floorClaim}
      />
    );
  }

  return (
    <section className="s-card" aria-label={t('account.title')}>
      {tabs.length > 1 && (
        <div
          role="tablist"
          aria-label={t('account.sections')}
          className="s-seg s-tabs"
          onKeyDown={onKeyDown}
        >
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              ref={(node) => {
                tabButtons.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`${baseId}-${tab.id}`}
              aria-controls={`${baseId}-panel`}
              aria-selected={tab.id === active}
              tabIndex={tab.id === active ? 0 : -1}
              className="s-seg-btn"
              onClick={() => setChosen(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}
      <div
        id={`${baseId}-panel`}
        role={tabs.length > 1 ? 'tabpanel' : undefined}
        aria-labelledby={tabs.length > 1 ? `${baseId}-${active}` : undefined}
        className="s-stack"
      >
        {panel}
      </div>
    </section>
  );
}
