import { useEffect, useId, useRef, useState } from 'react';
import { parseUnits, type Address } from 'viem';
import { approvalAmount, type ApprovalMode } from '../../factory/factoryTrade/tokenApproval.js';
import { planSoothAddLiquidity, type SoothLiquidity, type SoothLiquidityPreview } from '../data.js';
import type { SoothDataState } from '../dataHooks.js';
import { describeSoothError } from '../errors.js';
import type { SoothResolvedMarket } from '../runtime.js';
import type { SoothMarketActions } from '../tradeFlow.js';
import { formatShares, formatTokenAmount, formatTokenWithSymbol } from '../ui/format.js';
import type { SoothStrings } from '../ui/i18n.js';
import { Disclosure, Notice, Spinner } from '../ui/primitives.js';
import { exactToken } from './shared.js';

export interface LiquidityPanelProps {
  strings: SoothStrings;
  resolved: SoothResolvedMarket;
  account: Address;
  liquidity: SoothDataState<SoothLiquidity>;
  actions: SoothMarketActions;
  /** The floor claim is already offered with the trader claims. */
  hideFloor: boolean;
}

/**
 * LP receipts, LP claims and deposits (Demo FactoryLiquidityPanel). Deposits follow the trade
 * flow: review, then re-plan before every signature; an approval targets the AMM spender
 * exactly (zero reset first) and the deposit is signed only if the re-plan matches the review.
 */
export function LiquidityPanel({
  strings,
  resolved,
  account,
  liquidity,
  actions,
  hideFloor,
}: LiquidityPanelProps) {
  const { t } = strings;
  const id = useId();
  const [amount, setAmount] = useState('');
  const [preview, setPreview] = useState<SoothLiquidityPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [planning, setPlanning] = useState(false);
  const revision = useRef(0);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      revision.current++;
    };
  }, []);
  useEffect(() => {
    revision.current++;
    setPreview(null);
  }, [account]);
  const lp = liquidity.data;
  if (!lp)
    return liquidity.error ? (
      <Notice
        tone="error"
        title={t('liquidity.loadFailed')}
        action={
          <button
            type="button"
            className="s-btn s-btn-secondary s-btn-sm"
            onClick={liquidity.refresh}
          >
            {t('common.retry')}
          </button>
        }
      >
        {liquidity.error}
      </Notice>
    ) : (
      <p className="s-muted">
        <Spinner /> {t('common.loading')}
      </p>
    );
  const { token } = lp;
  const disabled = !actions.ready || planning;

  /** Re-plan from fresh reads; any intervening amount edit or unmount voids the result. */
  const plan = async (step: (next: SoothLiquidityPreview) => Promise<void>) => {
    if (planning || actions.busy) return;
    const current = revision.current;
    setPlanning(true);
    setError(null);
    try {
      if (!/^\d+(?:\.\d+)?$/.test(amount) || (amount.split('.')[1]?.length ?? 0) > token.decimals)
        throw new Error(
          t('liquidity.amountInvalid', { symbol: token.symbol, decimals: token.decimals }),
        );
      const next = await planSoothAddLiquidity(
        resolved,
        account,
        parseUnits(amount, token.decimals),
      );
      if (!mounted.current) return;
      if (current !== revision.current) throw new Error(t('trade.inputsChanged'));
      await step(next);
    } catch (reason) {
      if (mounted.current) setError(describeSoothError(reason));
    } finally {
      if (mounted.current) setPlanning(false);
    }
  };
  const approve = (mode: ApprovalMode = 'unlimited') =>
    plan(async (next) => {
      if (!preview || preview.approveNative === null) return;
      if (next.approveNative === null) {
        setPreview(next);
        return;
      }
      if (
        next.approveNative !== preview.approveNative ||
        next.allowance > 0n !== preview.allowance > 0n
      ) {
        setPreview(next);
        throw new Error(t('trade.approvalStepChanged'));
      }
      setPreview(null);
      await actions.execute({
        kind: 'approve',
        venue: 'amm',
        amountNative: approvalAmount({ ...next, approveNative: next.approveNative }, mode),
      });
    });
  const submit = () =>
    plan(async (next) => {
      if (!preview) return;
      if (next.approveNative !== null) {
        setPreview(next);
        throw new Error(t('trade.approvalChanged'));
      }
      if (
        next.requiredNative !== preview.requiredNative ||
        next.quotedNative !== preview.quotedNative ||
        next.receiptUnits !== preview.receiptUnits
      ) {
        setPreview(next);
        throw new Error(t('trade.quoteChanged'));
      }
      setPreview(null);
      await actions.execute(next.action);
    });

  const claims = lp.claims.filter((claim) => !(hideFloor && claim.action.kind === 'claimFloor'));
  return (
    <>
      <h3>{t('liquidity.yourReceipts')}</h3>
      {lp.receipts.length ? (
        <ul className="s-list">
          {lp.receipts.map((receipt) => {
            const receiptId = String(receipt.positionId);
            const buttons = [
              receipt.claimAvailable && {
                label: t('claims.claimAll'),
                action: receipt.claimAvailable,
                tone: 's-btn-primary',
              },
              receipt.claimFees && {
                label: t('liquidity.claimFees'),
                action: receipt.claimFees,
                tone: 's-btn-secondary',
              },
              receipt.redeem && {
                label: t('liquidity.redeem'),
                action: receipt.redeem,
                tone: 's-btn-secondary',
              },
            ].filter((button) => button !== null);
            return (
              <li key={receiptId} className="s-stack">
                <strong>{t('liquidity.receipt', { id: receiptId })}</strong>
                <div className="s-kv">
                  <span>{t('liquidity.units')}</span>
                  <span>{formatShares(receipt.units)}</span>
                </div>
                {receipt.valueIfYesWad !== null && (
                  <div className="s-kv">
                    <span>{t('liquidity.valueIfYes')}</span>
                    <span>
                      {formatTokenAmount(receipt.valueIfYesWad, 18)} {token.symbol}
                    </span>
                  </div>
                )}
                {receipt.valueIfNoWad !== null && (
                  <div className="s-kv">
                    <span>{t('liquidity.valueIfNo')}</span>
                    <span>
                      {formatTokenAmount(receipt.valueIfNoWad, 18)} {token.symbol}
                    </span>
                  </div>
                )}
                <div className="s-kv">
                  <span>{t('liquidity.feesEarned')}</span>
                  <span>
                    {receipt.feesNative !== null
                      ? formatTokenWithSymbol(receipt.feesNative, token.decimals, token.symbol, 4)
                      : '—'}
                  </span>
                </div>
                {receipt.feesGap && <p className="s-small s-muted">{receipt.feesGap}</p>}
                {buttons.length > 0 && (
                  <div className="s-row s-wrap">
                    {buttons.map((button) => (
                      <button
                        key={button.label}
                        type="button"
                        className={`s-btn s-btn-sm ${button.tone}`}
                        aria-label={t('liquidity.actionFor', {
                          action: button.label,
                          id: receiptId,
                        })}
                        disabled={disabled}
                        onClick={() => void actions.execute(button.action)}
                      >
                        {button.label}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="s-muted">{t('liquidity.empty')}</p>
      )}
      {claims.map((claim) => (
        <div key={claim.action.kind} className="s-stack">
          <div className="s-kv">
            <span>
              {claim.action.kind === 'claimFloor' ? t('claims.floorLabel') : t('liquidity.lpFees')}
            </span>
            <span>
              {formatTokenWithSymbol(claim.amountNative, token.decimals, token.symbol, 4)}
            </span>
          </div>
          <button
            type="button"
            className="s-btn s-btn-primary s-btn-block"
            disabled={disabled}
            onClick={() => void actions.execute(claim.action)}
          >
            {claim.action.kind === 'claimFloor' ? t('claims.floor') : t('liquidity.claimLpFees')}
          </button>
        </div>
      ))}
      {lp.liquidityOpen ? (
        <form
          className="s-stack"
          aria-label={t('liquidity.add')}
          onSubmit={(event) => {
            event.preventDefault();
            void plan(async (next) => setPreview(next));
          }}
        >
          <h3>{t('liquidity.add')}</h3>
          <div className="s-field">
            <label className="s-field-label" htmlFor={`${id}-deposit`}>
              {t('liquidity.depositAmount')}
            </label>
            <div className="s-input-wrap">
              <input
                id={`${id}-deposit`}
                className="s-input s-input-num"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                value={amount}
                onChange={(event) => {
                  revision.current++;
                  setAmount(event.target.value);
                  setPreview(null);
                  setError(null);
                }}
              />
              <span className="s-input-suffix" aria-hidden="true">
                {token.symbol}
              </span>
            </div>
          </div>
          <p className="s-small s-muted">{t('liquidity.notice')}</p>
          {!preview && (
            <button type="submit" className="s-btn s-btn-secondary s-btn-block" disabled={disabled}>
              {planning ? t('trade.preparing') : t('liquidity.review')}
            </button>
          )}
        </form>
      ) : (
        <p className="s-small s-muted">{t('liquidity.closed')}</p>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      {preview && (
        <section className="s-card s-card-flat" aria-label={t('liquidity.reviewTitle')}>
          <p>{preview.description}</p>
          <div className="s-kv">
            <span>{t('liquidity.quoted')}</span>
            <span>{exactToken(preview.quotedNative, token)}</span>
          </div>
          <div className="s-kv">
            <span>{t('liquidity.maxDeposit')}</span>
            <span>{exactToken(preview.requiredNative, token)}</span>
          </div>
          <div className="s-kv">
            <span>{t('liquidity.receiptUnits')}</span>
            <span>{formatShares(preview.receiptUnits)}</span>
          </div>
          {preview.approveNative !== null ? (
            <>
              <p>
                {t('liquidity.authorizeOnly', { amount: exactToken(preview.approveNative, token) })}
              </p>
              <Disclosure summary={t('trade.approvalRecipient')}>
                <code>{resolved.context.contracts.amm}</code>
              </Disclosure>
              {preview.allowance > 0n ? (
                <>
                  <p>{t('trade.resetFirst')}</p>
                  <button
                    type="button"
                    className="s-btn s-btn-primary s-btn-block"
                    disabled={disabled}
                    onClick={() => void approve()}
                  >
                    {t('trade.resetAllowance')}
                  </button>
                </>
              ) : (
                <>
                  <p className="s-small s-muted">
                    {t('trade.unlimitedNote', { symbol: token.symbol })}
                  </p>
                  <button
                    type="button"
                    className="s-btn s-btn-primary s-btn-block"
                    disabled={disabled}
                    onClick={() => void approve('unlimited')}
                  >
                    {t('trade.approveUnlimited', { symbol: token.symbol })}
                  </button>
                  <button
                    type="button"
                    className="s-btn s-btn-secondary s-btn-block"
                    disabled={disabled}
                    onClick={() => void approve('exact')}
                  >
                    {t('trade.approveExact')}
                  </button>
                </>
              )}
            </>
          ) : (
            <button
              type="button"
              className="s-btn s-btn-primary s-btn-block"
              disabled={disabled}
              onClick={() => void submit()}
            >
              {t('liquidity.confirm')}
            </button>
          )}
          <button
            type="button"
            className="s-btn s-btn-ghost s-btn-block"
            disabled={planning}
            onClick={() => {
              revision.current++;
              setPreview(null);
            }}
          >
            {t('common.cancel')}
          </button>
        </section>
      )}
    </>
  );
}
