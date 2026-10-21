/** ERC20 approval amounts use the collateral token's native units. */

/**
 * An unlimited ERC20 approval: the user's explicit choice in the widget, so later trades
 * and deposits with the same verified spender need no approval and no reset step. It is
 * never a planner limit (`approvalLimitNative` stays finite).
 */
export const UNLIMITED_APPROVAL = (1n << 256n) - 1n;

/** How the user approves: unlimited (one approval) or the exact amount of this transaction. */
export type ApprovalMode = 'unlimited' | 'exact';

/** The approve amount to sign for a reviewed approval step. A reset is always zero. */
export function approvalAmount(
  step: { allowance: bigint; approveNative: bigint },
  mode: ApprovalMode,
): bigint {
  if (step.allowance > 0n) return 0n;
  return mode === 'unlimited' ? UNLIMITED_APPROVAL : step.approveNative;
}
export interface TokenApprovalInput {
  allowance: bigint;
  requiredNative: bigint;
  /** Omit for the exact transaction bound. Custom limits must be finite. */
  approvalLimitNative?: bigint;
}

export type TokenApprovalPlan =
  | { ok: true; approveNative: bigint | null }
  | { ok: false; reason: string };

/** A reusable grant never changes the transaction's spending bound. */
export function planTokenApproval({
  allowance,
  requiredNative,
  approvalLimitNative,
}: TokenApprovalInput): TokenApprovalPlan {
  const maxUint256 = (1n << 256n) - 1n;
  if (requiredNative < 0n || requiredNative >= maxUint256 || allowance < 0n)
    return { ok: false, reason: 'Invalid approval amount.' };
  if (
    approvalLimitNative !== undefined &&
    (approvalLimitNative <= 0n || approvalLimitNative >= maxUint256)
  )
    return { ok: false, reason: 'Enter a positive, finite spending limit.' };
  if (approvalLimitNative !== undefined && approvalLimitNative < requiredNative)
    return {
      ok: false,
      reason:
        'The spending limit is below the current required amount. Increase it or use the exact amount.',
    };
  return {
    ok: true,
    approveNative: allowance >= requiredNative ? null : (approvalLimitNative ?? requiredNative),
  };
}
